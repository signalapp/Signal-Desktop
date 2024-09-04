// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { omit } from 'lodash';

import * as durations from '../util/durations';
import * as log from '../logging/log';
import {
  type AttachmentDownloadJobTypeType,
  type AttachmentDownloadJobType,
  type CoreAttachmentDownloadJobType,
  coreAttachmentDownloadJobSchema,
} from '../types/AttachmentDownload';
import {
  AttachmentPermanentlyUndownloadableError,
  downloadAttachment as downloadAttachmentUtil,
} from '../util/downloadAttachment';
import { DataWriter } from '../sql/Client';
import { getValue } from '../RemoteConfig';

import { isInCall as isInCallSelector } from '../state/selectors/calling';
import {
  AttachmentSizeError,
  type AttachmentType,
  AttachmentVariant,
} from '../types/Attachment';
import { __DEPRECATED$getMessageById } from '../messages/getMessageById';
import {
  KIBIBYTE,
  getMaximumIncomingAttachmentSizeInKb,
  getMaximumIncomingTextAttachmentSizeInKb,
} from '../types/AttachmentSize';
import { addAttachmentToMessage } from '../messageModifiers/AttachmentDownloads';
import * as Errors from '../types/errors';
import { redactGenericText } from '../util/privacy';
import {
  JobManager,
  type JobManagerParamsType,
  type JobManagerJobResultType,
} from './JobManager';
import {
  isImageTypeSupported,
  isVideoTypeSupported,
} from '../util/GoogleChrome';
import type { MIMEType } from '../types/MIME';
import type { AttachmentDownloadSource } from '../sql/Interface';
import { drop } from '../util/drop';
import { getAttachmentCiphertextLength } from '../AttachmentCrypto';

export enum AttachmentDownloadUrgency {
  IMMEDIATE = 'immediate',
  STANDARD = 'standard',
}

// Type for adding a new job
export type NewAttachmentDownloadJobType = {
  attachment: AttachmentType;
  messageId: string;
  receivedAt: number;
  sentAt: number;
  attachmentType: AttachmentDownloadJobTypeType;
  source: AttachmentDownloadSource;
  urgency?: AttachmentDownloadUrgency;
};

const MAX_CONCURRENT_JOBS = 3;

const DEFAULT_RETRY_CONFIG = {
  maxAttempts: 5,
  backoffConfig: {
    // 30 seconds, 5 minutes, 50 minutes, (max) 6 hrs
    multiplier: 10,
    firstBackoffs: [30 * durations.SECOND],
    maxBackoffTime: 6 * durations.HOUR,
  },
};
const BACKUP_RETRY_CONFIG = {
  ...DEFAULT_RETRY_CONFIG,
  maxAttempts: Infinity,
};
type AttachmentDownloadManagerParamsType = Omit<
  JobManagerParamsType<CoreAttachmentDownloadJobType>,
  'getNextJobs' | 'runJob'
> & {
  getNextJobs: (options: {
    limit: number;
    prioritizeMessageIds?: Array<string>;
    timestamp?: number;
  }) => Promise<Array<AttachmentDownloadJobType>>;
  runDownloadAttachmentJob: (args: {
    job: AttachmentDownloadJobType;
    isLastAttempt: boolean;
    options?: { isForCurrentlyVisibleMessage: boolean };
    dependencies: { downloadAttachment: typeof downloadAttachmentUtil };
  }) => Promise<JobManagerJobResultType<CoreAttachmentDownloadJobType>>;
};

function getJobId(job: CoreAttachmentDownloadJobType): string {
  const { messageId, attachmentType, digest } = job;
  return `${messageId}.${attachmentType}.${digest}`;
}

function getJobIdForLogging(job: CoreAttachmentDownloadJobType): string {
  const { sentAt, attachmentType, digest } = job;
  const redactedDigest = redactGenericText(digest);
  return `${sentAt}.${attachmentType}.${redactedDigest}`;
}

export class AttachmentDownloadManager extends JobManager<CoreAttachmentDownloadJobType> {
  private visibleTimelineMessages: Set<string> = new Set();
  private static _instance: AttachmentDownloadManager | undefined;
  override logPrefix = 'AttachmentDownloadManager';

  static defaultParams: AttachmentDownloadManagerParamsType = {
    markAllJobsInactive: DataWriter.resetAttachmentDownloadActive,
    saveJob: DataWriter.saveAttachmentDownloadJob,
    removeJob: DataWriter.removeAttachmentDownloadJob,
    getNextJobs: DataWriter.getNextAttachmentDownloadJobs,
    runDownloadAttachmentJob,
    shouldHoldOffOnStartingQueuedJobs: () => {
      const reduxState = window.reduxStore?.getState();
      if (reduxState) {
        return isInCallSelector(reduxState);
      }
      return false;
    },
    getJobId,
    getJobIdForLogging,
    getRetryConfig: job =>
      job.attachment.backupLocator?.mediaName
        ? BACKUP_RETRY_CONFIG
        : DEFAULT_RETRY_CONFIG,
    maxConcurrentJobs: MAX_CONCURRENT_JOBS,
  };

  constructor(params: AttachmentDownloadManagerParamsType) {
    super({
      ...params,
      getNextJobs: ({ limit }) => {
        return params.getNextJobs({
          limit,
          prioritizeMessageIds: [...this.visibleTimelineMessages],
          timestamp: Date.now(),
        });
      },
      runJob: (job: AttachmentDownloadJobType, isLastAttempt: boolean) => {
        const isForCurrentlyVisibleMessage = this.visibleTimelineMessages.has(
          job.messageId
        );
        return params.runDownloadAttachmentJob({
          job,
          isLastAttempt,
          options: {
            isForCurrentlyVisibleMessage,
          },
          dependencies: { downloadAttachment: downloadAttachmentUtil },
        });
      },
    });
  }

  // @ts-expect-error we are overriding the return type of JobManager's addJob
  override async addJob(
    newJobData: NewAttachmentDownloadJobType
  ): Promise<AttachmentType> {
    const {
      attachment,
      messageId,
      attachmentType,
      receivedAt,
      sentAt,
      source,
      urgency = AttachmentDownloadUrgency.STANDARD,
    } = newJobData;
    const parseResult = coreAttachmentDownloadJobSchema.safeParse({
      messageId,
      receivedAt,
      sentAt,
      attachmentType,
      digest: attachment.digest,
      contentType: attachment.contentType,
      size: attachment.size,
      ciphertextSize: getAttachmentCiphertextLength(attachment.size),
      attachment,
      source,
    });

    if (!parseResult.success) {
      log.error(
        `AttachmentDownloadManager/addJob(${sentAt}.${attachmentType}): invalid data`,
        parseResult.error
      );
      return attachment;
    }

    const newJob = parseResult.data;

    await this._addJob(newJob, {
      forceStart: urgency === AttachmentDownloadUrgency.IMMEDIATE,
    });

    return attachment;
  }

  updateVisibleTimelineMessages(messageIds: Array<string>): void {
    this.visibleTimelineMessages = new Set(messageIds);
  }

  static get instance(): AttachmentDownloadManager {
    if (!AttachmentDownloadManager._instance) {
      AttachmentDownloadManager._instance = new AttachmentDownloadManager(
        AttachmentDownloadManager.defaultParams
      );
    }
    return AttachmentDownloadManager._instance;
  }

  static async start(): Promise<void> {
    await AttachmentDownloadManager.instance.start();
  }

  static async stop(): Promise<void> {
    return AttachmentDownloadManager._instance?.stop();
  }

  static async addJob(
    newJob: NewAttachmentDownloadJobType
  ): Promise<AttachmentType> {
    return AttachmentDownloadManager.instance.addJob(newJob);
  }

  static updateVisibleTimelineMessages(messageIds: Array<string>): void {
    AttachmentDownloadManager.instance.updateVisibleTimelineMessages(
      messageIds
    );
  }
}
async function runDownloadAttachmentJob({
  job,
  isLastAttempt,
  options,
  dependencies,
}: {
  job: AttachmentDownloadJobType;
  isLastAttempt: boolean;
  options?: { isForCurrentlyVisibleMessage: boolean };
  dependencies: { downloadAttachment: typeof downloadAttachmentUtil };
}): Promise<JobManagerJobResultType<CoreAttachmentDownloadJobType>> {
  const jobIdForLogging = getJobIdForLogging(job);
  const logId = `AttachmentDownloadManager/runDownloadAttachmentJob/${jobIdForLogging}`;

  const message = await __DEPRECATED$getMessageById(job.messageId);

  if (!message) {
    log.error(`${logId} message not found`);
    return { status: 'finished' };
  }

  try {
    log.info(`${logId}: Starting job`);

    const result = await runDownloadAttachmentJobInner({
      job,
      isForCurrentlyVisibleMessage:
        options?.isForCurrentlyVisibleMessage ?? false,
      dependencies,
    });

    if (result.downloadedVariant === AttachmentVariant.ThumbnailFromBackup) {
      return {
        status: 'finished',
        newJob: { ...job, attachment: result.attachmentWithThumbnail },
      };
    }

    if (job.attachment.backupLocator?.mediaName) {
      const currentDownloadedSize =
        window.storage.get('backupAttachmentsSuccessfullyDownloadedSize') ?? 0;
      drop(
        window.storage.put(
          'backupAttachmentsSuccessfullyDownloadedSize',
          currentDownloadedSize + job.ciphertextSize
        )
      );
    }

    return {
      status: 'finished',
    };
  } catch (error) {
    log.error(
      `${logId}: Failed to download attachment, attempt ${job.attempts}:`,
      Errors.toLogFormat(error)
    );

    if (error instanceof AttachmentSizeError) {
      await addAttachmentToMessage(
        message.id,
        _markAttachmentAsTooBig(job.attachment),
        logId,
        { type: job.attachmentType }
      );
      return { status: 'finished' };
    }

    if (error instanceof AttachmentPermanentlyUndownloadableError) {
      await addAttachmentToMessage(
        message.id,
        _markAttachmentAsPermanentlyErrored(job.attachment),
        logId,
        { type: job.attachmentType }
      );

      return { status: 'finished' };
    }

    if (isLastAttempt) {
      await addAttachmentToMessage(
        message.id,
        _markAttachmentAsTransientlyErrored(job.attachment),
        logId,
        { type: job.attachmentType }
      );
      return { status: 'finished' };
    }

    // Remove `pending` flag from the attachment and retry later
    await addAttachmentToMessage(
      message.id,
      {
        ...job.attachment,
        pending: false,
      },
      logId,
      { type: job.attachmentType }
    );
    return { status: 'retry' };
  } finally {
    // This will fail if the message has been deleted before the download finished, which
    // is good
    await DataWriter.saveMessage(message.attributes, {
      ourAci: window.textsecure.storage.user.getCheckedAci(),
    });
  }
}

type DownloadAttachmentResultType =
  | { downloadedVariant: AttachmentVariant.Default }
  | {
      downloadedVariant: AttachmentVariant.ThumbnailFromBackup;
      attachmentWithThumbnail: AttachmentType;
    };

export async function runDownloadAttachmentJobInner({
  job,
  isForCurrentlyVisibleMessage,
  dependencies,
}: {
  job: AttachmentDownloadJobType;
  isForCurrentlyVisibleMessage: boolean;
  dependencies: { downloadAttachment: typeof downloadAttachmentUtil };
}): Promise<DownloadAttachmentResultType> {
  const { messageId, attachment, attachmentType } = job;

  const jobIdForLogging = getJobIdForLogging(job);
  let logId = `AttachmentDownloadManager/runDownloadJobInner(${jobIdForLogging})`;

  if (!job || !attachment || !messageId) {
    throw new Error(`${logId}: Key information required for job was missing.`);
  }

  const maxInKib = getMaximumIncomingAttachmentSizeInKb(getValue);
  const maxTextAttachmentSizeInKib =
    getMaximumIncomingTextAttachmentSizeInKb(getValue);

  const { size } = attachment;
  const sizeInKib = size / KIBIBYTE;

  if (!Number.isFinite(size) || size < 0 || sizeInKib > maxInKib) {
    throw new AttachmentSizeError(
      `${logId}: Attachment was ${sizeInKib}kib, max is ${maxInKib}kib`
    );
  }
  if (
    attachmentType === 'long-message' &&
    sizeInKib > maxTextAttachmentSizeInKib
  ) {
    throw new AttachmentSizeError(
      `${logId}: Text attachment was ${sizeInKib}kib, max is ${maxTextAttachmentSizeInKib}kib`
    );
  }

  const preferBackupThumbnail =
    isForCurrentlyVisibleMessage &&
    mightHaveThumbnailOnBackupTier(job.attachment) &&
    // TODO (DESKTOP-7204): check if thumbnail exists on attachment, not on job
    !job.attachment.thumbnailFromBackup;

  if (preferBackupThumbnail) {
    logId += '.preferringBackupThumbnail';
  }

  if (preferBackupThumbnail) {
    try {
      const attachmentWithThumbnail = await downloadBackupThumbnail({
        attachment,
        dependencies,
      });
      await addAttachmentToMessage(messageId, attachmentWithThumbnail, logId, {
        type: attachmentType,
      });
      return {
        downloadedVariant: AttachmentVariant.ThumbnailFromBackup,
        attachmentWithThumbnail,
      };
    } catch (e) {
      log.warn(`${logId}: error when trying to download thumbnail`);
    }
  }

  // TODO (DESKTOP-7204): currently we only set pending state when downloading the
  // full-size attachment
  await addAttachmentToMessage(
    messageId,
    { ...attachment, pending: true },
    logId,
    { type: attachmentType }
  );

  try {
    const downloaded = await dependencies.downloadAttachment({
      attachment,
      variant: AttachmentVariant.Default,
    });

    const upgradedAttachment =
      await window.Signal.Migrations.processNewAttachment({
        ...omit(attachment, ['error', 'pending', 'downloadPath']),
        ...downloaded,
      });

    await addAttachmentToMessage(messageId, upgradedAttachment, logId, {
      type: attachmentType,
    });
    return { downloadedVariant: AttachmentVariant.Default };
  } catch (error) {
    if (
      !job.attachment.thumbnailFromBackup &&
      mightHaveThumbnailOnBackupTier(attachment) &&
      !preferBackupThumbnail
    ) {
      log.error(
        `${logId}: failed to download fullsize attachment, falling back to thumbnail`,
        Errors.toLogFormat(error)
      );
      try {
        const attachmentWithThumbnail = omit(
          await downloadBackupThumbnail({
            attachment,
            dependencies,
          }),
          'pending'
        );
        await addAttachmentToMessage(
          messageId,
          attachmentWithThumbnail,
          logId,
          {
            type: attachmentType,
          }
        );
        return {
          downloadedVariant: AttachmentVariant.ThumbnailFromBackup,
          attachmentWithThumbnail,
        };
      } catch (thumbnailError) {
        log.error(
          `${logId}: fallback attempt to download thumbnail failed`,
          Errors.toLogFormat(thumbnailError)
        );
      }
    }
    throw error;
  }
}

async function downloadBackupThumbnail({
  attachment,
  dependencies,
}: {
  attachment: AttachmentType;
  dependencies: { downloadAttachment: typeof downloadAttachmentUtil };
}): Promise<AttachmentType> {
  const downloadedThumbnail = await dependencies.downloadAttachment({
    attachment,
    variant: AttachmentVariant.ThumbnailFromBackup,
  });

  const attachmentWithThumbnail = {
    ...attachment,
    thumbnailFromBackup: downloadedThumbnail,
  };

  return attachmentWithThumbnail;
}

function _markAttachmentAsTooBig(attachment: AttachmentType): AttachmentType {
  return {
    ..._markAttachmentAsPermanentlyErrored(attachment),
    wasTooBig: true,
  };
}

function _markAttachmentAsPermanentlyErrored(
  attachment: AttachmentType
): AttachmentType {
  return { ...omit(attachment, ['key', 'id']), pending: false, error: true };
}

function _markAttachmentAsTransientlyErrored(
  attachment: AttachmentType
): AttachmentType {
  return { ...attachment, pending: false, error: true };
}

function mightHaveThumbnailOnBackupTier(
  attachment: Pick<AttachmentType, 'backupLocator' | 'contentType'>
): boolean {
  if (!attachment.backupLocator?.mediaName) {
    return false;
  }

  return canAttachmentHaveThumbnail(attachment.contentType);
}

export function canAttachmentHaveThumbnail(contentType: MIMEType): boolean {
  return isVideoTypeSupported(contentType) || isImageTypeSupported(contentType);
}
