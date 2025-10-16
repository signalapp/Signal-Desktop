// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import lodash from 'lodash';
import { statfs } from 'node:fs/promises';

import * as durations from '../util/durations/index.std.js';
import { createLogger } from '../logging/log.std.js';
import type { AttachmentBackfillResponseSyncEvent } from '../textsecure/messageReceiverEvents.std.js';
import {
  type MessageAttachmentType,
  type AttachmentDownloadJobType,
  type CoreAttachmentDownloadJobType,
  AttachmentDownloadUrgency,
  coreAttachmentDownloadJobSchema,
  MediaTier,
} from '../types/AttachmentDownload.std.js';
import {
  downloadAttachment as downloadAttachmentUtil,
  isIncrementalMacVerificationError,
} from '../util/downloadAttachment.preload.js';
import {
  deleteDownloadData as doDeleteDownloadData,
  processNewAttachment as doProcessNewAttachment,
} from '../util/migrations.preload.js';
import { DataReader, DataWriter } from '../sql/Client.preload.js';
import { getValue } from '../RemoteConfig.dom.js';

import { isInCall as isInCallSelector } from '../state/selectors/calling.std.js';
import {
  AttachmentSizeError,
  type AttachmentType,
  AttachmentVariant,
  AttachmentPermanentlyUndownloadableError,
} from '../types/Attachment.std.js';
import {
  wasImportedFromLocalBackup,
  canAttachmentHaveThumbnail,
  shouldAttachmentEndUpInRemoteBackup,
  getUndownloadedAttachmentSignature,
  isIncremental,
  hasRequiredInformationForBackup,
} from '../util/Attachment.std.js';
import type { ReadonlyMessageAttributesType } from '../model-types.d.ts';
import { backupsService } from '../services/backups/index.preload.js';
import { getMessageById } from '../messages/getMessageById.preload.js';
import {
  KIBIBYTE,
  getMaximumIncomingAttachmentSizeInKb,
  getMaximumIncomingTextAttachmentSizeInKb,
} from '../types/AttachmentSize.std.js';
import { addAttachmentToMessage } from '../messageModifiers/AttachmentDownloads.preload.js';
import * as Errors from '../types/errors.std.js';
import { redactGenericText } from '../util/privacy.node.js';
import {
  JobManager,
  type JobManagerParamsType,
  type JobManagerJobResultType,
  type JobManagerJobType,
} from './JobManager.std.js';
import { IMAGE_WEBP } from '../types/MIME.std.js';
import { AttachmentDownloadSource } from '../sql/Interface.std.js';
import { drop } from '../util/drop.std.js';
import { type ReencryptedAttachmentV2 } from '../AttachmentCrypto.node.js';
import { safeParsePartial } from '../util/schemas.std.js';
import { deleteDownloadsJobQueue } from './deleteDownloadsJobQueue.preload.js';
import { createBatcher } from '../util/batcher.std.js';
import { showDownloadFailedToast } from '../util/showDownloadFailedToast.dom.js';
import { markAttachmentAsPermanentlyErrored } from '../util/attachments/markAttachmentAsPermanentlyErrored.std.js';
import {
  AttachmentBackfill,
  isPermanentlyUndownloadable,
  isPermanentlyUndownloadableWithoutBackfill,
} from './helpers/attachmentBackfill.preload.js';
import { formatCountForLogging } from '../logging/formatCountForLogging.std.js';
import { strictAssert } from '../util/assert.std.js';
import { getAttachmentCiphertextSize } from '../util/AttachmentCrypto.std.js';
import { updateBackupMediaDownloadProgress } from '../util/updateBackupMediaDownloadProgress.preload.js';
import { HTTPError } from '../types/HTTPError.std.js';
import { isOlderThan } from '../util/timestamp.std.js';
import { getMessageQueueTime as doGetMessageQueueTime } from '../util/getMessageQueueTime.dom.js';
import { JobCancelReason } from './types.std.js';
import { isAbortError } from '../util/isAbortError.std.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

const { noop, omit, throttle } = lodash;

const log = createLogger('AttachmentDownloadManager');

export { isPermanentlyUndownloadable };

// Type for adding a new job
export type NewAttachmentDownloadJobType = {
  attachment: AttachmentType;
  attachmentType: MessageAttachmentType;
  isManualDownload: boolean;
  messageId: string;
  receivedAt: number;
  sentAt: number;
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
  // Always retry if we think the item may end up being backed up
  maxAttempts: Infinity,
  backoffConfig: {
    // 30 seconds, 5 minutes, 50 minutes, 500 minutes (~8.3hrs), (max) 3 days
    multiplier: 10,
    firstBackoffs: [30 * durations.SECOND],
    maxBackoffTime: 3 * durations.DAY,
  },
};

type RunDownloadAttachmentJobOptions = {
  abortSignal: AbortSignal;
  isForCurrentlyVisibleMessage: boolean;
  maxAttachmentSizeInKib: number;
  maxTextAttachmentSizeInKib: number;
  hasMediaBackups: boolean;
};

type AttachmentDownloadManagerParamsType = Omit<
  JobManagerParamsType<CoreAttachmentDownloadJobType>,
  'getNextJobs' | 'runJob'
> & {
  getNextJobs: (options: {
    limit: number;
    prioritizeMessageIds?: Array<string>;
    sources?: Array<AttachmentDownloadSource>;
    timestamp?: number;
  }) => Promise<Array<AttachmentDownloadJobType>>;
  runDownloadAttachmentJob: (args: {
    job: AttachmentDownloadJobType;
    isLastAttempt: boolean;
    options: RunDownloadAttachmentJobOptions;
    dependencies?: DependenciesType;
  }) => Promise<JobManagerJobResultType<CoreAttachmentDownloadJobType>>;
  onLowDiskSpaceBackupImport: (bytesNeeded: number) => Promise<void>;
  hasMediaBackups: () => boolean;
  getMessageQueueTime: () => number;
  statfs: typeof statfs;
};

function getJobId(job: CoreAttachmentDownloadJobType): string {
  const { messageId, attachmentType, attachmentSignature } = job;
  return `${messageId}.${attachmentType}.${attachmentSignature}`;
}

function getJobIdForLogging(job: CoreAttachmentDownloadJobType): string {
  const { sentAt, attachmentType, attachmentSignature } = job;
  const redactedAttachmentSignature = redactGenericText(attachmentSignature);
  return `${sentAt}.${attachmentType}.${redactedAttachmentSignature}`;
}

export class AttachmentDownloadManager extends JobManager<CoreAttachmentDownloadJobType> {
  #visibleTimelineMessages: Set<string> = new Set();

  #saveJobsBatcher = createBatcher<AttachmentDownloadJobType>({
    name: 'saveAttachmentDownloadJobs',
    wait: 150,
    maxSize: 1000,
    processBatch: async jobs => {
      await DataWriter.saveAttachmentDownloadJobs(jobs);
      drop(this.maybeStartJobs());
    },
  });
  #onLowDiskSpaceBackupImport: (bytesNeeded: number) => Promise<void>;
  #getMessageQueueTime: () => number;
  #hasMediaBackups: () => boolean;
  #statfs: typeof statfs;
  #maxAttachmentSizeInKib = getMaximumIncomingAttachmentSizeInKb(getValue);
  #maxTextAttachmentSizeInKib =
    getMaximumIncomingTextAttachmentSizeInKb(getValue);

  #minimumFreeDiskSpace = this.#maxAttachmentSizeInKib * 5;

  #attachmentBackfill = new AttachmentBackfill();

  private static _instance: AttachmentDownloadManager | undefined;
  override logPrefix = 'AttachmentDownloadManager';

  static defaultParams: AttachmentDownloadManagerParamsType = {
    markAllJobsInactive: DataWriter.resetAttachmentDownloadActive,
    saveJob: async (job, options) => {
      if (options?.allowBatching) {
        if (AttachmentDownloadManager._instance != null) {
          AttachmentDownloadManager._instance.#saveJobsBatcher.add(job);
        }
      } else {
        await DataWriter.saveAttachmentDownloadJob(job);
      }
    },
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
      shouldAttachmentEndUpInRemoteBackup({
        attachment: job.attachment,
        hasMediaBackups: backupsService.hasMediaBackups(),
      })
        ? BACKUP_RETRY_CONFIG
        : DEFAULT_RETRY_CONFIG,
    maxConcurrentJobs: MAX_CONCURRENT_JOBS,
    onLowDiskSpaceBackupImport: async bytesNeeded => {
      if (!itemStorage.get('backupMediaDownloadPaused')) {
        await Promise.all([
          itemStorage.put('backupMediaDownloadPaused', true),
          // Show the banner to allow users to resume from the left pane
          itemStorage.put('backupMediaDownloadBannerDismissed', false),
        ]);
      }
      window.reduxActions.globalModals.showLowDiskSpaceBackupImportModal(
        bytesNeeded
      );
    },
    hasMediaBackups: () => backupsService.hasMediaBackups(),
    getMessageQueueTime: () => doGetMessageQueueTime(),
    statfs,
  };

  constructor(params: AttachmentDownloadManagerParamsType) {
    super({
      ...params,
      getNextJobs: ({ limit }) => {
        return params.getNextJobs({
          limit,
          prioritizeMessageIds: [...this.#visibleTimelineMessages],
          sources: itemStorage.get('backupMediaDownloadPaused')
            ? [
                AttachmentDownloadSource.STANDARD,
                AttachmentDownloadSource.BACKFILL,
              ]
            : undefined,
          timestamp: Date.now(),
        });
      },
      runJob: async (
        job: AttachmentDownloadJobType,
        {
          abortSignal,
          isLastAttempt,
        }: { abortSignal: AbortSignal; isLastAttempt: boolean }
      ) => {
        const isForCurrentlyVisibleMessage = this.#visibleTimelineMessages.has(
          job.messageId
        );

        if (job.source === AttachmentDownloadSource.BACKUP_IMPORT_WITH_MEDIA) {
          const { outOfSpace } =
            await this.#checkFreeDiskSpaceForBackupImport();
          if (outOfSpace) {
            return { status: 'retry' };
          }
        }

        return params.runDownloadAttachmentJob({
          job,
          isLastAttempt,
          options: {
            abortSignal,
            hasMediaBackups: this.#hasMediaBackups(),
            isForCurrentlyVisibleMessage,
            maxAttachmentSizeInKib: this.#maxAttachmentSizeInKib,
            maxTextAttachmentSizeInKib: this.#maxTextAttachmentSizeInKib,
          },
        });
      },
    });
    this.#onLowDiskSpaceBackupImport = params.onLowDiskSpaceBackupImport;
    this.#getMessageQueueTime = params.getMessageQueueTime;
    this.#hasMediaBackups = params.hasMediaBackups;
    this.#statfs = params.statfs;
  }

  // @ts-expect-error we are overriding the return type of JobManager's addJob
  override async addJob(
    newJobData: NewAttachmentDownloadJobType
  ): Promise<AttachmentType> {
    const {
      attachment,
      attachmentType,
      isManualDownload,
      messageId,
      receivedAt,
      sentAt,
      urgency = AttachmentDownloadUrgency.STANDARD,
    } = newJobData;

    let { source } = newJobData;

    if (
      source === AttachmentDownloadSource.BACKUP_IMPORT_WITH_MEDIA &&
      !hasRequiredInformationForBackup(attachment)
    ) {
      source = AttachmentDownloadSource.BACKUP_IMPORT_NO_MEDIA;
    }

    const logId = `AttachmentDownloadManager/addJob(${sentAt}.${attachmentType})`;

    // For non-media-enabled backups, we will skip queueing download for old attachments
    // that cannot still be on the transit tier
    if (source === AttachmentDownloadSource.BACKUP_IMPORT_NO_MEDIA) {
      if (attachment.error) {
        return attachment;
      }

      const attachmentUploadedAt = attachment.uploadTimestamp || sentAt;

      // Skip queueing download if attachment is older than twice the message queue time
      // (a generous buffer that ensures we download anything that could still exist on
      // the transit tier)
      if (isOlderThan(attachmentUploadedAt, this.#getMessageQueueTime() * 2)) {
        return attachment;
      }
    }

    const parseResult = safeParsePartial(coreAttachmentDownloadJobSchema, {
      attachment,
      attachmentType,
      // ciphertextSize is used for backup media download progress accounting; it may not
      // exactly match what we end up downloading, and that's OK (e.g. we may fallback to
      // download from the transit tier, which would be a slightly smaller size)
      ciphertextSize: getAttachmentCiphertextSize({
        unpaddedPlaintextSize: attachment.size,
        mediaTier:
          source === AttachmentDownloadSource.BACKUP_IMPORT_WITH_MEDIA
            ? MediaTier.BACKUP
            : MediaTier.STANDARD,
      }),
      contentType: attachment.contentType,
      attachmentSignature: getUndownloadedAttachmentSignature(attachment),
      isManualDownload,
      messageId,
      receivedAt,
      sentAt,
      size: attachment.size,
      source,
      originalSource: source,
    });

    if (!parseResult.success) {
      log.error(`${logId}: invalid data`, parseResult.error);
      return attachment;
    }

    const newJob = parseResult.data;

    await this._addJob(newJob, {
      forceStart: urgency === AttachmentDownloadUrgency.IMMEDIATE,
    });

    return attachment;
  }

  updateVisibleTimelineMessages(messageIds: Array<string>): void {
    this.#visibleTimelineMessages = new Set(messageIds);
  }

  async #getFreeDiskSpace(): Promise<number> {
    const { bsize, bavail } = await this.#statfs(
      window.SignalContext.getPath('userData')
    );
    return bsize * bavail;
  }

  async #checkFreeDiskSpaceForBackupImport(): Promise<{
    outOfSpace: boolean;
  }> {
    let freeDiskSpace: number;

    try {
      freeDiskSpace = await this.#getFreeDiskSpace();
    } catch (e) {
      log.error(
        'checkFreeDiskSpaceForBackupImport: error checking disk space',
        Errors.toLogFormat(e)
      );
      // Still attempt the download
      return { outOfSpace: false };
    }

    if (freeDiskSpace <= this.#minimumFreeDiskSpace) {
      const remainingBackupBytesToDownload =
        itemStorage.get('backupMediaDownloadTotalBytes', 0) -
        itemStorage.get('backupMediaDownloadCompletedBytes', 0);

      log.info(
        'checkFreeDiskSpaceForBackupImport: insufficient disk space. ' +
          `Available: ${formatCountForLogging(freeDiskSpace)}, ` +
          `Needed: ${formatCountForLogging(remainingBackupBytesToDownload)} ` +
          `Minimum threshold: ${this.#minimumFreeDiskSpace}`
      );

      await this.#onLowDiskSpaceBackupImport(remainingBackupBytesToDownload);
      return { outOfSpace: true };
    }

    return { outOfSpace: false };
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
    await AttachmentDownloadManager.saveBatchedJobs();
    await itemStorage.put('attachmentDownloadManagerIdled', false);
    await AttachmentDownloadManager.instance.start();
    drop(
      AttachmentDownloadManager.waitForIdle(async () => {
        await updateBackupMediaDownloadProgress(
          DataReader.getBackupAttachmentDownloadProgress
        );
        await itemStorage.put('attachmentDownloadManagerIdled', true);
      })
    );
  }

  static async saveBatchedJobs(): Promise<void> {
    await AttachmentDownloadManager.instance.#saveJobsBatcher.flushAndWait();
  }

  static async stop(): Promise<void> {
    return AttachmentDownloadManager._instance?.stop();
  }

  static async addJob(
    newJob: NewAttachmentDownloadJobType
  ): Promise<AttachmentType> {
    return AttachmentDownloadManager.instance.addJob(newJob);
  }

  static async cancelJobs(
    reason: JobCancelReason,
    predicate: (
      job: CoreAttachmentDownloadJobType & JobManagerJobType
    ) => boolean
  ): Promise<void> {
    return AttachmentDownloadManager.instance.cancelJobs(reason, predicate);
  }

  static updateVisibleTimelineMessages(messageIds: Array<string>): void {
    AttachmentDownloadManager.instance.updateVisibleTimelineMessages(
      messageIds
    );
  }

  static async waitForIdle(callback?: VoidFunction): Promise<void> {
    await AttachmentDownloadManager.instance.waitForIdle();
    if (callback) {
      callback();
    }
  }

  static async requestBackfill(
    message: ReadonlyMessageAttributesType
  ): Promise<void> {
    return this.instance.#attachmentBackfill.request(message);
  }

  static async handleBackfillResponse(
    event: AttachmentBackfillResponseSyncEvent
  ): Promise<void> {
    return this.instance.#attachmentBackfill.handleResponse(event);
  }
}

type DependenciesType = {
  deleteDownloadData: typeof doDeleteDownloadData;
  downloadAttachment: typeof downloadAttachmentUtil;
  processNewAttachment: typeof doProcessNewAttachment;
  runDownloadAttachmentJobInner: typeof runDownloadAttachmentJobInner;
};

/** @internal Exported only for testing */
export async function runDownloadAttachmentJob({
  job,
  isLastAttempt,
  options,
  dependencies = {
    deleteDownloadData: doDeleteDownloadData,
    downloadAttachment: downloadAttachmentUtil,
    processNewAttachment: doProcessNewAttachment,
    runDownloadAttachmentJobInner,
  },
}: {
  job: AttachmentDownloadJobType;
  isLastAttempt: boolean;
  options: RunDownloadAttachmentJobOptions;
  dependencies?: DependenciesType;
}): Promise<JobManagerJobResultType<CoreAttachmentDownloadJobType>> {
  const jobIdForLogging = getJobIdForLogging(job);
  const logId = `runDownloadAttachmentJob/${jobIdForLogging}`;

  const message = await getMessageById(job.messageId);

  if (!message) {
    log.info(`${logId} message not found, returning early`);
    return { status: 'finished' };
  }

  try {
    const result = await dependencies.runDownloadAttachmentJobInner({
      job,
      abortSignal: options.abortSignal,
      hasMediaBackups: options.hasMediaBackups,
      isForCurrentlyVisibleMessage:
        options?.isForCurrentlyVisibleMessage ?? false,
      maxAttachmentSizeInKib: options.maxAttachmentSizeInKib,
      maxTextAttachmentSizeInKib: options.maxTextAttachmentSizeInKib,
      dependencies,
    });

    if (result.downloadedVariant === AttachmentVariant.ThumbnailFromBackup) {
      return {
        status: 'retry',
        updatedJob: { ...job, attachment: result.attachmentWithThumbnail },
      };
    }

    return {
      status: 'finished',
    };
  } catch (error) {
    if (
      options.abortSignal.aborted &&
      options.abortSignal.reason === JobCancelReason.UserInitiated
    ) {
      log.info(
        `${logId}: User canceled attempt ${job.attempts}. Not scheduling a retry.`
      );
      // Remove `pending` flag from the attachment. User can retry later.
      await addAttachmentToMessage(
        message.id,
        {
          ...job.attachment,
          pending: false,
        },
        logId,
        { type: job.attachmentType }
      );
      return { status: 'finished' };
    }

    if (error instanceof AttachmentSizeError) {
      log.info(`${logId}: Attachment is too big.`);
      await addAttachmentToMessage(
        message.id,
        _markAttachmentAsTooBig(job.attachment),
        logId,
        { type: job.attachmentType }
      );
      return { status: 'finished' };
    }

    if (isIncrementalMacVerificationError(error)) {
      log.warn(
        'Attachment decryption failed with incrementalMac verification error; dropping incrementalMac'
      );
      // If incrementalMac fails verification, we will delete it and retry (without
      // streaming support)
      strictAssert(isIncremental(job.attachment), 'must have incrementalMac');
      const attachmentWithoutIncrementalMac: AttachmentType = {
        ...job.attachment,
        pending: false,
        incrementalMac: undefined,
        chunkSize: undefined,
      };
      // Double-check it no longer supports incremental playback just to make sure we
      // avoid any loops
      strictAssert(
        !isIncremental(attachmentWithoutIncrementalMac),
        'no longer has incrementalMac'
      );

      await addAttachmentToMessage(
        message.id,
        attachmentWithoutIncrementalMac,
        logId,
        { type: job.attachmentType }
      );
      return {
        status: 'retry',
        updatedJob: { ...job, attachment: attachmentWithoutIncrementalMac },
      };
    }

    if (error instanceof AttachmentPermanentlyUndownloadableError) {
      const canBackfill =
        job.isManualDownload &&
        AttachmentBackfill.isEnabledForJob(
          job.attachmentType,
          message.attributes
        );

      if (job.source !== AttachmentDownloadSource.BACKFILL && canBackfill) {
        log.info(
          `${logId}: Attachment is permanently undownloadable, requesting backfill.`
        );
        await AttachmentDownloadManager.requestBackfill(message.attributes);
        return { status: 'finished' };
      }

      log.info(`${logId}: Attachment is permanently undownloadable.`);

      await addAttachmentToMessage(
        message.id,
        markAttachmentAsPermanentlyErrored(job.attachment, {
          backfillError: false,
        }),
        logId,
        { type: job.attachmentType }
      );

      return { status: 'finished' };
    }

    const logText = `${logId}: Failed to fetch attachment, attempt ${job.attempts}: ${Errors.toLogFormat(error)}`;
    if (error instanceof HTTPError) {
      log.info(logText);
    } else {
      log.warn(logText);
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
    await window.MessageCache.saveMessage(message.attributes);
  }
}

type DownloadAttachmentResultType =
  | { downloadedVariant: AttachmentVariant.Default }
  | {
      downloadedVariant: AttachmentVariant.ThumbnailFromBackup;
      attachmentWithThumbnail: AttachmentType;
    };

/** @internal Exported only for testing */
export async function runDownloadAttachmentJobInner({
  job,
  abortSignal,
  isForCurrentlyVisibleMessage,
  maxAttachmentSizeInKib,
  maxTextAttachmentSizeInKib,
  hasMediaBackups,
  dependencies,
}: {
  job: AttachmentDownloadJobType;
  dependencies: Omit<DependenciesType, 'runDownloadAttachmentJobInner'>;
} & RunDownloadAttachmentJobOptions): Promise<DownloadAttachmentResultType> {
  const { messageId, attachment, attachmentType } = job;

  const jobIdForLogging = getJobIdForLogging(job);
  let logId = `runDownloadAttachmentJobInner(${jobIdForLogging})`;

  if (!job || !attachment || !messageId) {
    throw new Error(`${logId}: Key information required for job was missing.`);
  }

  const { size } = attachment;
  const sizeInKib = size / KIBIBYTE;

  if (
    !Number.isFinite(size) ||
    size < 0 ||
    sizeInKib > maxAttachmentSizeInKib
  ) {
    throw new AttachmentSizeError(
      `${logId}: Attachment was ${sizeInKib}kib, max is ${maxAttachmentSizeInKib}kib`
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
  const mightBeInRemoteBackup = shouldAttachmentEndUpInRemoteBackup({
    attachment,
    hasMediaBackups,
  });
  const wasAttachmentImportedFromLocalBackup =
    wasImportedFromLocalBackup(attachment);
  const alreadyDownloadedBackupThumbnail = Boolean(
    job.attachment.thumbnailFromBackup
  );

  const mightHaveBackupThumbnailToDownload =
    !alreadyDownloadedBackupThumbnail &&
    mightBeInRemoteBackup &&
    canAttachmentHaveThumbnail(attachment) &&
    !wasAttachmentImportedFromLocalBackup;

  const attemptBackupThumbnailFirst =
    isForCurrentlyVisibleMessage && mightHaveBackupThumbnailToDownload;

  let attachmentWithBackupThumbnail: AttachmentType | undefined;

  if (attemptBackupThumbnailFirst) {
    logId += '.preferringBackupThumbnail';

    try {
      attachmentWithBackupThumbnail = await downloadBackupThumbnail({
        attachment,
        abortSignal,
        dependencies,
        logId,
      });
      await addAttachmentToMessage(
        messageId,
        attachmentWithBackupThumbnail,
        logId,
        {
          type: attachmentType,
        }
      );
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      log.warn(
        `${logId}: error when trying to download thumbnail`,
        Errors.toLogFormat(error)
      );
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

  if (
    job.source !== AttachmentDownloadSource.BACKFILL &&
    isPermanentlyUndownloadableWithoutBackfill(job.attachment)
  ) {
    // We should only get to here only if
    throw new AttachmentPermanentlyUndownloadableError(
      'Not downloadable without backfill'
    );
  }

  try {
    const { downloadPath } = attachment;
    let totalDownloaded = 0;
    let downloadedAttachment: ReencryptedAttachmentV2 | undefined;

    const onSizeUpdate = async (totalBytes: number) => {
      if (abortSignal.aborted) {
        return;
      }
      if (downloadedAttachment) {
        return;
      }

      totalDownloaded = Math.min(totalBytes, attachment.size);
      await addAttachmentToMessage(
        messageId,
        { ...attachment, totalDownloaded, pending: true },
        logId,
        { type: attachmentType }
      );
    };

    downloadedAttachment = await dependencies.downloadAttachment({
      attachment,
      options: {
        variant: AttachmentVariant.Default,
        onSizeUpdate: throttle(onSizeUpdate, 200),
        abortSignal,
        hasMediaBackups,
        logId,
      },
    });

    const upgradedAttachment = await dependencies.processNewAttachment(
      {
        ...omit(attachment, ['error', 'pending']),
        ...downloadedAttachment,
      },
      attachmentType
    );

    const isShowingLightbox = (): boolean => {
      const lightboxState = window.reduxStore.getState().lightbox;
      if (!lightboxState.isShowingLightbox) {
        return false;
      }
      if (lightboxState.selectedIndex == null) {
        return false;
      }

      const selectedMedia = lightboxState.media[lightboxState.selectedIndex];
      if (selectedMedia?.message.id !== messageId) {
        return false;
      }

      return selectedMedia.attachment.digest === attachment.digest;
    };

    const shouldDeleteDownload = downloadPath && !isShowingLightbox();
    if (downloadPath) {
      if (shouldDeleteDownload) {
        await dependencies.deleteDownloadData(downloadPath);
      } else {
        deleteDownloadsJobQueue.pause();
        await deleteDownloadsJobQueue.add({
          digest: attachment.digest,
          downloadPath,
          messageId,
          plaintextHash: attachment.plaintextHash,
        });
      }
    }

    await addAttachmentToMessage(
      messageId,
      shouldDeleteDownload
        ? omit(upgradedAttachment, ['downloadPath', 'totalDownloaded'])
        : omit(upgradedAttachment, ['totalDownloaded']),
      logId,
      {
        type: attachmentType,
      }
    );
    return { downloadedVariant: AttachmentVariant.Default };
  } catch (error) {
    if (isIncrementalMacVerificationError(error)) {
      throw error;
    }
    if (isAbortError(error)) {
      throw error;
    }
    if (mightHaveBackupThumbnailToDownload && !attemptBackupThumbnailFirst) {
      log.error(
        `${logId}: failed to download fullsize attachment, falling back to backup thumbnail`,
        Errors.toLogFormat(error)
      );
      try {
        attachmentWithBackupThumbnail = await downloadBackupThumbnail({
          attachment,
          abortSignal,
          dependencies,
          logId,
        });

        await addAttachmentToMessage(
          messageId,
          { ...attachmentWithBackupThumbnail, pending: false },
          logId,
          {
            type: attachmentType,
          }
        );
      } catch (thumbnailError) {
        log.error(
          `${logId}: fallback attempt to download thumbnail failed`,
          Errors.toLogFormat(thumbnailError)
        );
      }
    }

    if (attachmentWithBackupThumbnail) {
      return {
        downloadedVariant: AttachmentVariant.ThumbnailFromBackup,
        attachmentWithThumbnail: attachmentWithBackupThumbnail,
      };
    }

    let showToast = false;

    // Show toast if manual download failed
    if (!abortSignal.aborted && job.isManualDownload) {
      if (job.source === AttachmentDownloadSource.BACKFILL) {
        // ...and it was already a backfill request
        showToast = true;
      } else {
        // ...or we didn't backfill the download
        const message = await getMessageById(job.messageId);
        showToast =
          message != null &&
          !AttachmentBackfill.isEnabledForJob(
            attachmentType,
            message.attributes
          );
      }
    }

    if (showToast) {
      showDownloadFailedToast(messageId);
    }

    throw error;
  }
}

async function downloadBackupThumbnail({
  attachment,
  abortSignal,
  logId,
  dependencies,
}: {
  attachment: AttachmentType;
  abortSignal: AbortSignal;
  logId: string;
  dependencies: {
    downloadAttachment: typeof downloadAttachmentUtil;
  };
}): Promise<AttachmentType> {
  const downloadedThumbnail = await dependencies.downloadAttachment({
    attachment,
    options: {
      onSizeUpdate: noop,
      variant: AttachmentVariant.ThumbnailFromBackup,
      abortSignal,
      hasMediaBackups: true,
      logId,
    },
  });

  const calculatedSize = downloadedThumbnail.size;
  strictAssert(calculatedSize, 'size must be calculated for backup thumbnails');

  const attachmentWithThumbnail = {
    ...attachment,
    thumbnailFromBackup: {
      contentType: IMAGE_WEBP,
      ...downloadedThumbnail,
      size: calculatedSize,
    },
  };

  return attachmentWithThumbnail;
}

function _markAttachmentAsTooBig(attachment: AttachmentType): AttachmentType {
  return {
    ...markAttachmentAsPermanentlyErrored(attachment, {
      backfillError: false,
    }),
    wasTooBig: true,
  };
}

function _markAttachmentAsTransientlyErrored(
  attachment: AttachmentType
): AttachmentType {
  return { ...attachment, pending: false, error: true };
}
