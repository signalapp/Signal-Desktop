// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable max-classes-per-file */

import { existsSync } from 'node:fs';
import { PassThrough } from 'node:stream';

import * as durations from '../util/durations/index.std.js';
import { createLogger } from '../logging/log.std.js';
import { DataWriter } from '../sql/Client.preload.js';

import * as Errors from '../types/errors.std.js';
import { redactGenericText } from '../util/privacy.node.js';
import {
  JobManager,
  type JobManagerParamsType,
  type JobManagerJobResultType,
} from './JobManager.std.js';
import { strictAssert } from '../util/assert.std.js';
import { getAbsoluteAttachmentPath as doGetAbsoluteAttachmentPath } from '../util/migrations.preload.js';
import {
  type BackupsService,
  backupsService,
} from '../services/backups/index.preload.js';
import {
  type EncryptedAttachmentV2,
  decryptAttachmentV2ToSink,
} from '../AttachmentCrypto.node.js';
import {
  getBackupMediaRootKey,
  deriveBackupMediaKeyMaterial,
  deriveBackupThumbnailTransitKeyMaterial,
} from '../services/backups/crypto.preload.js';
import {
  type AttachmentBackupJobType,
  type CoreAttachmentBackupJobType,
  type StandardAttachmentBackupJobType,
  type ThumbnailAttachmentBackupJobType,
} from '../types/AttachmentBackup.std.js';
import { isInCall as isInCallSelector } from '../state/selectors/calling.std.js';
import { encryptAndUploadAttachment } from '../util/uploadAttachment.preload.js';
import { getAttachmentCiphertextSize } from '../util/AttachmentCrypto.std.js';
import {
  getMediaIdFromMediaName,
  getMediaNameForAttachmentThumbnail,
} from '../services/backups/util/mediaId.preload.js';
import { fromBase64, toBase64 } from '../Bytes.std.js';
import { backupMediaBatch as doBackupMediaBatch } from '../textsecure/WebAPI.preload.js';
import type { AttachmentType } from '../types/Attachment.std.js';
import { canAttachmentHaveThumbnail } from '../util/Attachment.std.js';
import { mightStillBeOnTransitTier } from '../util/mightStillBeOnTransitTier.dom.js';
import {
  type CreatedThumbnailType,
  makeImageThumbnailForBackup,
  makeVideoScreenshot,
} from '../types/VisualAttachment.dom.js';
import { missingCaseError } from '../util/missingCaseError.std.js';
import {
  isImageTypeSupported,
  isVideoTypeSupported,
} from '../util/GoogleChrome.std.js';
import { getLocalAttachmentUrl } from '../util/getLocalAttachmentUrl.std.js';
import { findRetryAfterTimeFromError } from './helpers/findRetryAfterTimeFromError.std.js';
import { BackupCredentialType } from '../types/backups.node.js';
import { supportsIncrementalMac } from '../types/MIME.std.js';
import type { MIMEType } from '../types/MIME.std.js';
import { MediaTier } from '../types/AttachmentDownload.std.js';

const log = createLogger('AttachmentBackupManager');

const MAX_CONCURRENT_JOBS = 3;
const RETRY_CONFIG = {
  // As long as we have the file locally, we're always going to keep trying
  maxAttempts: Infinity,
  backoffConfig: {
    // 1 minute, 5 minutes, 25 minutes, every hour
    multiplier: 5,
    firstBackoffs: [durations.MINUTE],
    maxBackoffTime: durations.HOUR,
  },
};
const THUMBNAIL_RETRY_CONFIG = {
  ...RETRY_CONFIG,
  // Thumbnails are optional so we don't need to try indefinitely
  maxAttempts: 3,
};

export class AttachmentBackupManager extends JobManager<CoreAttachmentBackupJobType> {
  private static _instance: AttachmentBackupManager | undefined;
  static defaultParams: JobManagerParamsType<CoreAttachmentBackupJobType> = {
    markAllJobsInactive: DataWriter.markAllAttachmentBackupJobsInactive,
    saveJob: DataWriter.saveAttachmentBackupJob,
    removeJob: DataWriter.removeAttachmentBackupJob,
    getNextJobs: DataWriter.getNextAttachmentBackupJobs,
    runJob: runAttachmentBackupJob,
    shouldHoldOffOnStartingQueuedJobs: () => {
      const reduxState = window.reduxStore?.getState();
      if (reduxState) {
        return isInCallSelector(reduxState);
      }
      return false;
    },
    getJobId,
    getJobIdForLogging,
    getRetryConfig: job => {
      if (job.type === 'standard') {
        return RETRY_CONFIG;
      }
      return THUMBNAIL_RETRY_CONFIG;
    },
    maxConcurrentJobs: MAX_CONCURRENT_JOBS,
  };

  override logPrefix = 'AttachmentBackupManager';

  async addJobAndMaybeThumbnailJob(
    job: CoreAttachmentBackupJobType
  ): Promise<void> {
    await this.addJob(job);
    if (job.type === 'standard') {
      if (canAttachmentHaveThumbnail({ contentType: job.data.contentType })) {
        await this.addJob({
          type: 'thumbnail',
          mediaName: getMediaNameForAttachmentThumbnail(job.mediaName),
          receivedAt: job.receivedAt,
          data: {
            fullsizePath: job.data.path,
            fullsizeSize: job.data.size,
            contentType: job.data.contentType,
            version: job.data.version,
            localKey: job.data.localKey,
          },
        });
      }
    }
  }

  static get instance(): AttachmentBackupManager {
    if (!AttachmentBackupManager._instance) {
      AttachmentBackupManager._instance = new AttachmentBackupManager(
        AttachmentBackupManager.defaultParams
      );
    }
    return AttachmentBackupManager._instance;
  }

  static addJobAndMaybeThumbnailJob(
    job: CoreAttachmentBackupJobType
  ): Promise<void> {
    return AttachmentBackupManager.instance.addJobAndMaybeThumbnailJob(job);
  }

  static async start(): Promise<void> {
    log.info('starting');
    await AttachmentBackupManager.instance.start();
  }

  static async stop(): Promise<void> {
    log.info('stopping');
    return AttachmentBackupManager._instance?.stop();
  }

  static async addJob(newJob: CoreAttachmentBackupJobType): Promise<void> {
    return AttachmentBackupManager.instance.addJob(newJob);
  }

  static async waitForIdle(): Promise<void> {
    return AttachmentBackupManager.instance.waitForIdle();
  }
}

function getJobId(job: CoreAttachmentBackupJobType): string {
  return job.mediaName;
}

function getJobIdForLogging(job: CoreAttachmentBackupJobType): string {
  return `${redactGenericText(job.mediaName)}.${job.type}`;
}

/**
 * Backup-specific methods
 */
class AttachmentPermanentlyMissingError extends Error {}
class FileNotFoundOnTransitTierError extends Error {}

type RunAttachmentBackupJobDependenciesType = {
  getAbsoluteAttachmentPath: typeof doGetAbsoluteAttachmentPath;
  backupMediaBatch?: typeof doBackupMediaBatch;
  backupsService: BackupsService;
  encryptAndUploadAttachment: typeof encryptAndUploadAttachment;
  decryptAttachmentV2ToSink: typeof decryptAttachmentV2ToSink;
};

export async function runAttachmentBackupJob(
  job: AttachmentBackupJobType,
  _options: {
    isLastAttempt: boolean;
    abortSignal: AbortSignal;
  },
  dependencies: RunAttachmentBackupJobDependenciesType = {
    getAbsoluteAttachmentPath: doGetAbsoluteAttachmentPath,
    backupsService,
    backupMediaBatch: doBackupMediaBatch,
    encryptAndUploadAttachment,
    decryptAttachmentV2ToSink,
  }
): Promise<JobManagerJobResultType<CoreAttachmentBackupJobType>> {
  const jobIdForLogging = getJobIdForLogging(job);
  const logId = `AttachmentBackupManager/runAttachmentBackupJob/${jobIdForLogging}`;
  try {
    await runAttachmentBackupJobInner(job, dependencies);
    return { status: 'finished' };
  } catch (error) {
    log.error(
      `${logId}: Failed to backup attachment, attempt ${job.attempts}`,
      Errors.toLogFormat(error)
    );

    if (error instanceof AttachmentPermanentlyMissingError) {
      log.error(`${logId}: Attachment unable to be found, giving up on job`);
      return { status: 'finished' };
    }

    if (
      error instanceof Error &&
      'code' in error &&
      (error.code === 413 || error.code === 429)
    ) {
      return {
        status: 'rate-limited',
        pauseDurationMs: findRetryAfterTimeFromError(error),
      };
    }

    return { status: 'retry' };
  }
}

async function runAttachmentBackupJobInner(
  job: AttachmentBackupJobType,
  dependencies: RunAttachmentBackupJobDependenciesType
): Promise<void> {
  const jobIdForLogging = getJobIdForLogging(job);
  const logId = `AttachmentBackupManager.UploadOrCopyToBackupTier(${jobIdForLogging})`;

  log.info(`${logId}: starting`);

  const mediaId = getMediaIdFromMediaName(job.mediaName);

  const { isInBackupTier } = await dependencies.backupsService.getBackupCdnInfo(
    mediaId.string
  );

  if (isInBackupTier) {
    log.info(`${logId}: object already in backup tier, done`);
    return;
  }

  const jobType = job.type;

  switch (jobType) {
    case 'standard':
      return backupStandardAttachment(job, dependencies);
    case 'thumbnail':
      return backupThumbnailAttachment(job, dependencies);
    default:
      throw missingCaseError(jobType);
  }
}

async function backupStandardAttachment(
  job: StandardAttachmentBackupJobType,
  dependencies: RunAttachmentBackupJobDependenciesType
) {
  const jobIdForLogging = getJobIdForLogging(job);
  const logId = `AttachmentBackupManager.backupStandardAttachment(${jobIdForLogging})`;
  const { contentType, keys, localKey, path, size, transitCdnInfo, version } =
    job.data;

  const mediaId = getMediaIdFromMediaName(job.mediaName);
  const backupKeyMaterial = deriveBackupMediaKeyMaterial(
    getBackupMediaRootKey(),
    mediaId.bytes
  );

  if (transitCdnInfo) {
    const {
      cdnKey: transitCdnKey,
      cdnNumber: transitCdnNumber,
      uploadTimestamp: transitCdnUploadTimestamp,
    } = transitCdnInfo;
    if (mightStillBeOnTransitTier(transitCdnInfo)) {
      try {
        await copyToBackupTier({
          cdnKey: transitCdnKey,
          cdnNumber: transitCdnNumber,
          size,
          mediaId: mediaId.string,
          ...backupKeyMaterial,
          dependencies,
        });
        log.info(`${logId}: copied to backup tier successfully`);
        return;
      } catch (e) {
        if (e instanceof FileNotFoundOnTransitTierError) {
          log.info(
            `${logId}: file not found on transit tier, uploadTimestamp: ${transitCdnUploadTimestamp}`
          );
        } else {
          log.error(
            `${logId}: error copying to backup tier`,
            Errors.toLogFormat(e)
          );
          throw e;
        }
      }
    }
  }

  if (!path) {
    throw new AttachmentPermanentlyMissingError(
      'File not on transit tier and no path property'
    );
  }

  const absolutePath = dependencies.getAbsoluteAttachmentPath(path);
  if (!existsSync(absolutePath)) {
    throw new AttachmentPermanentlyMissingError('No file at provided path');
  }

  log.info(`${logId}: uploading to transit tier`);
  const uploadResult = await uploadToTransitTier({
    absolutePath,
    contentType,
    dependencies,
    keys,
    localKey,
    logPrefix: logId,
    size,
    version,
  });

  log.info(`${logId}: copying to backup tier`);
  await copyToBackupTier({
    cdnKey: uploadResult.cdnKey,
    cdnNumber: uploadResult.cdnNumber,
    size,
    mediaId: mediaId.string,
    ...backupKeyMaterial,
    dependencies,
  });
}

async function backupThumbnailAttachment(
  job: ThumbnailAttachmentBackupJobType,
  dependencies: RunAttachmentBackupJobDependenciesType
) {
  const jobIdForLogging = getJobIdForLogging(job);
  const logId = `AttachmentBackupManager.backupThumbnailAttachment(${jobIdForLogging})`;

  const mediaId = getMediaIdFromMediaName(job.mediaName);

  const backupKeyMaterial = deriveBackupMediaKeyMaterial(
    getBackupMediaRootKey(),
    mediaId.bytes
  );

  const { fullsizePath, fullsizeSize, contentType, version, localKey } =
    job.data;

  if (!canAttachmentHaveThumbnail({ contentType })) {
    log.error(
      `${logId}: cannot generate thumbnail for contentType: ${contentType}`
    );
    return;
  }

  if (!fullsizePath) {
    throw new AttachmentPermanentlyMissingError('No fullsizePath property');
  }

  const fullsizeAbsolutePath =
    dependencies.getAbsoluteAttachmentPath(fullsizePath);

  if (!existsSync(fullsizeAbsolutePath)) {
    throw new AttachmentPermanentlyMissingError(
      'No fullsize file at provided path'
    );
  }

  let thumbnail: CreatedThumbnailType;

  const fullsizeUrl = getLocalAttachmentUrl({
    contentType,
    localKey,
    path: fullsizePath,
    size: fullsizeSize,
    version,
  });

  if (isVideoTypeSupported(contentType)) {
    // TODO (DESKTOP-7204): pull screenshot path from attachments table if it already
    // exists
    const { blob: screenshotBlob } = await makeVideoScreenshot({
      objectUrl: fullsizeUrl,
    });
    const screenshotObjectUrl = URL.createObjectURL(screenshotBlob);
    thumbnail = await makeImageThumbnailForBackup({
      objectUrl: screenshotObjectUrl,
    });
  } else if (isImageTypeSupported(contentType)) {
    thumbnail = await makeImageThumbnailForBackup({
      objectUrl: fullsizeUrl,
    });
  } else {
    log.error(
      `${logId}: cannot generate thumbnail for contentType: ${contentType}`
    );
    return;
  }

  const { aesKey, macKey } = deriveBackupThumbnailTransitKeyMaterial(
    getBackupMediaRootKey(),
    mediaId.bytes
  );

  log.info(`${logId}: uploading thumbnail to transit tier`);
  const uploadResult = await uploadThumbnailToTransitTier({
    data: thumbnail.data,
    dependencies,
    keys: toBase64(Buffer.concat([aesKey, macKey])),
    logPrefix: logId,
  });

  log.info(`${logId}: copying thumbnail to backup tier`);
  await copyToBackupTier({
    cdnKey: uploadResult.cdnKey,
    cdnNumber: uploadResult.cdnNumber,
    mediaId: mediaId.string,
    size: thumbnail.data.byteLength,
    ...backupKeyMaterial,
    dependencies,
  });
}

type UploadToTransitTierArgsType = {
  absolutePath: string;
  contentType: MIMEType;
  dependencies: {
    decryptAttachmentV2ToSink: typeof decryptAttachmentV2ToSink;
    encryptAndUploadAttachment: typeof encryptAndUploadAttachment;
  };
  keys: string;
  localKey?: string;
  logPrefix: string;
  size: number;
  version?: AttachmentType['version'];
};

type UploadResponseType = {
  cdnKey: string;
  cdnNumber: number;
  encrypted: EncryptedAttachmentV2;
};
async function uploadToTransitTier({
  absolutePath,
  contentType,
  dependencies,
  keys,
  localKey,
  logPrefix,
  size,
  version,
}: UploadToTransitTierArgsType): Promise<UploadResponseType> {
  const needIncrementalMac = supportsIncrementalMac(contentType);

  try {
    if (version === 2) {
      strictAssert(
        localKey != null,
        'Missing localKey for version 2 attachment'
      );

      const sink = new PassThrough();

      // This `Promise.all` is chaining two separate pipelines via
      // a pass-through `sink`.
      const [, result] = await Promise.all([
        dependencies.decryptAttachmentV2ToSink(
          {
            ciphertextPath: absolutePath,
            idForLogging: 'uploadToTransitTier',
            keysBase64: localKey,
            size,
            type: 'local',
          },
          sink
        ),
        dependencies.encryptAndUploadAttachment({
          keys: fromBase64(keys),
          needIncrementalMac,
          plaintext: { stream: sink, size },
          uploadType: 'backup',
        }),
      ]);

      return result;
    }

    // Legacy attachments
    return dependencies.encryptAndUploadAttachment({
      keys: fromBase64(keys),
      needIncrementalMac,
      plaintext: { absolutePath },
      uploadType: 'backup',
    });
  } catch (error) {
    log.error(
      `${logPrefix}/uploadToTransitTier: Error while encrypting and uploading`,
      Errors.toLogFormat(error)
    );
    throw error;
  }
}

async function uploadThumbnailToTransitTier({
  data,
  keys,
  logPrefix,
  dependencies,
}: {
  data: Uint8Array;
  keys: string;
  logPrefix: string;
  dependencies: {
    decryptAttachmentV2ToSink: typeof decryptAttachmentV2ToSink;
    encryptAndUploadAttachment: typeof encryptAndUploadAttachment;
  };
}): Promise<UploadResponseType> {
  try {
    const uploadResult = await dependencies.encryptAndUploadAttachment({
      plaintext: { data },
      keys: fromBase64(keys),
      needIncrementalMac: false,
      uploadType: 'backup',
    });
    return uploadResult;
  } catch (error) {
    log.error(
      `${logPrefix}/uploadThumbnailToTransitTier: Error while encrypting and uploading`,
      Errors.toLogFormat(error)
    );
    throw error;
  }
}

export const FILE_NOT_FOUND_ON_TRANSIT_TIER_STATUS = 410;

async function copyToBackupTier({
  cdnNumber,
  cdnKey,
  size,
  mediaId,
  macKey,
  aesKey,
  dependencies,
}: {
  cdnNumber: number;
  cdnKey: string;
  size: number;
  mediaId: string;
  macKey: Uint8Array;
  aesKey: Uint8Array;
  dependencies: {
    backupMediaBatch?: typeof doBackupMediaBatch;
    backupsService: BackupsService;
  };
}): Promise<{ cdnNumberOnBackup: number }> {
  strictAssert(
    dependencies.backupMediaBatch,
    'backupMediaBatch must be intialized'
  );
  const ciphertextSizeOnTransitTier = getAttachmentCiphertextSize({
    unpaddedPlaintextSize: size,
    mediaTier: MediaTier.STANDARD,
  });

  const { responses } = await dependencies.backupMediaBatch({
    headers: await dependencies.backupsService.credentials.getHeadersForToday(
      BackupCredentialType.Media
    ),
    items: [
      {
        sourceAttachment: {
          cdn: cdnNumber,
          key: cdnKey,
        },
        objectLength: ciphertextSizeOnTransitTier,
        mediaId,
        hmacKey: macKey,
        encryptionKey: aesKey,
      },
    ],
  });

  const response = responses[0];
  if (!response.isSuccess) {
    if (response.status === FILE_NOT_FOUND_ON_TRANSIT_TIER_STATUS) {
      throw new FileNotFoundOnTransitTierError();
    }
    throw new Error(
      `copyToBackupTier failed: ${response.failureReason}, code: ${response.status}`
    );
  }

  // Update our local understanding of what's in the backup cdn
  const ciphertextSizeOnBackupTier = getAttachmentCiphertextSize({
    unpaddedPlaintextSize: size,
    mediaTier: MediaTier.BACKUP,
  });

  await DataWriter.saveBackupCdnObjectMetadata([
    {
      mediaId,
      cdnNumber: response.cdn,
      sizeOnBackupCdn: ciphertextSizeOnBackupTier,
    },
  ]);

  return {
    cdnNumberOnBackup: response.cdn,
  };
}
