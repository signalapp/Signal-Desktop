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
  downloadAttachment,
} from '../util/downloadAttachment';
import dataInterface from '../sql/Client';
import { getValue } from '../RemoteConfig';

import { isInCall as isInCallSelector } from '../state/selectors/calling';
import { AttachmentSizeError, type AttachmentType } from '../types/Attachment';
import { __DEPRECATED$getMessageById } from '../messages/getMessageById';
import type { MessageModel } from '../models/messages';
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
type AttachmentDownloadManagerParamsType = Omit<
  JobManagerParamsType<CoreAttachmentDownloadJobType>,
  'getNextJobs'
> & {
  getNextJobs: (options: {
    limit: number;
    prioritizeMessageIds?: Array<string>;
    timestamp?: number;
  }) => Promise<Array<AttachmentDownloadJobType>>;
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
  private visibleTimelineMessages: Array<string> = [];
  private static _instance: AttachmentDownloadManager | undefined;
  override logPrefix = 'AttachmentDownloadManager';

  static defaultParams: AttachmentDownloadManagerParamsType = {
    markAllJobsInactive: dataInterface.resetAttachmentDownloadActive,
    saveJob: dataInterface.saveAttachmentDownloadJob,
    removeJob: dataInterface.removeAttachmentDownloadJob,
    getNextJobs: dataInterface.getNextAttachmentDownloadJobs,
    runJob: runDownloadAttachmentJob,
    shouldHoldOffOnStartingQueuedJobs: () => {
      const reduxState = window.reduxStore?.getState();
      if (reduxState) {
        return isInCallSelector(reduxState);
      }
      return false;
    },
    getJobId,
    getJobIdForLogging,
    getRetryConfig: () => DEFAULT_RETRY_CONFIG,
    maxConcurrentJobs: MAX_CONCURRENT_JOBS,
  };

  constructor(params: AttachmentDownloadManagerParamsType) {
    super({
      ...params,
      getNextJobs: ({ limit }) => {
        return params.getNextJobs({
          limit,
          prioritizeMessageIds: this.visibleTimelineMessages,
          timestamp: Date.now(),
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
      attachment,
    });

    if (!parseResult.success) {
      log.error(
        `AttachmentDownloadManager/addJob(${sentAt}.${attachmentType}): invalid data`,
        parseResult.error
      );
      return attachment;
    }

    const newJob = parseResult.data;

    const { isAlreadyRunning } = await this._addJob(newJob, {
      forceStart: urgency === AttachmentDownloadUrgency.IMMEDIATE,
    });

    if (isAlreadyRunning) {
      return attachment;
    }

    return {
      ...attachment,
      pending: !this.params.shouldHoldOffOnStartingQueuedJobs?.(),
    };
  }

  updateVisibleTimelineMessages(messageIds: Array<string>): void {
    this.visibleTimelineMessages = messageIds;
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
    log.info('AttachmentDownloadManager/starting');
    await AttachmentDownloadManager.instance.start();
  }

  static async stop(): Promise<void> {
    log.info('AttachmentDownloadManager/stopping');
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

// TODO (DESKTOP-6913): if a prioritized job is selected, we will to update the
// in-memory job with that information so we can handle it differently, including
// e.g. downloading a thumbnail before the full-size version
async function runDownloadAttachmentJob(
  job: AttachmentDownloadJobType,
  isLastAttempt: boolean
): Promise<JobManagerJobResultType> {
  const jobIdForLogging = getJobIdForLogging(job);
  const logId = `AttachmentDownloadManager/runDownloadAttachmentJob/${jobIdForLogging}`;

  const message = await __DEPRECATED$getMessageById(job.messageId);

  if (!message) {
    log.error(`${logId} message not found`);
    return { status: 'finished' };
  }

  try {
    log.info(`${logId}: Starting job`);
    await runDownloadAttachmentJobInner(job, message);
    return { status: 'finished' };
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
    await dataInterface.saveMessage(message.attributes, {
      ourAci: window.textsecure.storage.user.getCheckedAci(),
    });
  }
}

async function runDownloadAttachmentJobInner(
  job: AttachmentDownloadJobType,
  message: MessageModel
): Promise<void> {
  const { messageId, attachment, attachmentType: type } = job;

  const jobIdForLogging = getJobIdForLogging(job);
  const logId = `AttachmentDownloadManager/runDownloadJobInner(${jobIdForLogging})`;

  if (!job || !attachment || !messageId) {
    throw new Error(`${logId}: Key information required for job was missing.`);
  }

  log.info(`${logId}: starting`);

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
  if (type === 'long-message' && sizeInKib > maxTextAttachmentSizeInKib) {
    throw new AttachmentSizeError(
      `${logId}: Text attachment was ${sizeInKib}kib, max is ${maxTextAttachmentSizeInKib}kib`
    );
  }

  await addAttachmentToMessage(
    message.id,
    { ...attachment, pending: true },
    logId,
    { type }
  );

  const downloaded = await downloadAttachment(attachment);

  const upgradedAttachment =
    await window.Signal.Migrations.processNewAttachment(downloaded);

  await addAttachmentToMessage(
    message.id,
    omit(upgradedAttachment, ['error', 'pending']),
    logId,
    {
      type,
    }
  );
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
