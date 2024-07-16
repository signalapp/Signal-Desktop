// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable max-classes-per-file */

import { existsSync } from 'node:fs';
import { PassThrough } from 'node:stream';

import * as durations from '../util/durations';
import * as log from '../logging/log';
import dataInterface from '../sql/Client';

import * as Errors from '../types/errors';
import { redactGenericText } from '../util/privacy';
import {
  JobManager,
  type JobManagerParamsType,
  type JobManagerJobResultType,
} from './JobManager';
import {
  deriveBackupMediaKeyMaterial,
  deriveBackupMediaThumbnailInnerEncryptionKeyMaterial,
} from '../Crypto';
import { strictAssert } from '../util/assert';
import { type BackupsService, backupsService } from '../services/backups';
import {
  type EncryptedAttachmentV2,
  getAttachmentCiphertextLength,
  getAesCbcCiphertextLength,
  decryptAttachmentV2ToSink,
  ReencryptedDigestMismatchError,
} from '../AttachmentCrypto';
import { getBackupKey } from '../services/backups/crypto';
import {
  type AttachmentBackupJobType,
  type CoreAttachmentBackupJobType,
  type StandardAttachmentBackupJobType,
  type ThumbnailAttachmentBackupJobType,
} from '../types/AttachmentBackup';
import { isInCall as isInCallSelector } from '../state/selectors/calling';
import { encryptAndUploadAttachment } from '../util/uploadAttachment';
import {
  getMediaIdFromMediaName,
  getMediaNameForAttachmentThumbnail,
} from '../services/backups/util/mediaId';
import { fromBase64, toBase64 } from '../Bytes';
import type { WebAPIType } from '../textsecure/WebAPI';
import {
  type AttachmentType,
  mightStillBeOnTransitTier,
} from '../types/Attachment';
import {
  type CreatedThumbnailType,
  makeImageThumbnailForBackup,
  makeVideoScreenshot,
} from '../types/VisualAttachment';
import { missingCaseError } from '../util/missingCaseError';
import { canAttachmentHaveThumbnail } from './AttachmentDownloadManager';
import {
  isImageTypeSupported,
  isVideoTypeSupported,
} from '../util/GoogleChrome';
import { getLocalAttachmentUrl } from '../util/getLocalAttachmentUrl';

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
    markAllJobsInactive: dataInterface.markAllAttachmentBackupJobsInactive,
    saveJob: dataInterface.saveAttachmentBackupJob,
    removeJob: dataInterface.removeAttachmentBackupJob,
    getNextJobs: dataInterface.getNextAttachmentBackupJobs,
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
      if (canAttachmentHaveThumbnail(job.data.contentType)) {
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
    log.info('AttachmentBackupManager/starting');
    await AttachmentBackupManager.instance.start();
  }

  static async stop(): Promise<void> {
    log.info('AttachmentBackupManager/stopping');
    return AttachmentBackupManager._instance?.stop();
  }

  static async addJob(newJob: CoreAttachmentBackupJobType): Promise<void> {
    return AttachmentBackupManager.instance.addJob(newJob);
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
  getAbsoluteAttachmentPath: typeof window.Signal.Migrations.getAbsoluteAttachmentPath;
  backupMediaBatch?: WebAPIType['backupMediaBatch'];
  backupsService: BackupsService;
  encryptAndUploadAttachment: typeof encryptAndUploadAttachment;
  decryptAttachmentV2ToSink: typeof decryptAttachmentV2ToSink;
};

export async function runAttachmentBackupJob(
  job: AttachmentBackupJobType,
  _isLastAttempt: boolean,
  dependencies: RunAttachmentBackupJobDependenciesType = {
    getAbsoluteAttachmentPath:
      window.Signal.Migrations.getAbsoluteAttachmentPath,
    backupsService,
    backupMediaBatch: window.textsecure.server?.backupMediaBatch,
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

    if (error instanceof ReencryptedDigestMismatchError) {
      log.error(
        `${logId}: Unable to reencrypt to match same digest; content must have changed`
      );
      return { status: 'finished' };
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
  const { path, transitCdnInfo, iv, digest, keys, size, version, localKey } =
    job.data;

  const mediaId = getMediaIdFromMediaName(job.mediaName);
  const backupKeyMaterial = deriveBackupMediaKeyMaterial(
    getBackupKey(),
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
    version,
    localKey,
    size,
    keys,
    iv,
    digest,
    logPrefix: logId,
    dependencies,
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
    getBackupKey(),
    mediaId.bytes
  );

  const { fullsizePath, fullsizeSize, contentType, version, localKey } =
    job.data;

  if (!canAttachmentHaveThumbnail(contentType)) {
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
    path: fullsizePath,
    size: fullsizeSize,
    contentType,
    version,
    localKey,
  });

  if (isVideoTypeSupported(contentType)) {
    // TODO (DESKTOP-7204): pull screenshot path from attachments table if it already
    // exists
    const screenshotBlob = await makeVideoScreenshot({
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

  const { aesKey, macKey } =
    deriveBackupMediaThumbnailInnerEncryptionKeyMaterial(
      getBackupKey(),
      mediaId.bytes
    );

  log.info(`${logId}: uploading thumbnail to transit tier`);
  const uploadResult = await uploadThumbnailToTransitTier({
    data: thumbnail.data,
    keys: toBase64(Buffer.concat([aesKey, macKey])),
    logPrefix: logId,
    dependencies,
  });

  log.info(`${logId}: copying thumbnail to backup tier`);
  await copyToBackupTier({
    cdnKey: uploadResult.cdnKey,
    cdnNumber: uploadResult.cdnNumber,
    size: thumbnail.data.byteLength,
    mediaId: mediaId.string,
    ...backupKeyMaterial,
    dependencies,
  });
}

type UploadToTransitTierArgsType = {
  absolutePath: string;
  iv: string;
  digest: string;
  keys: string;
  version?: AttachmentType['version'];
  localKey?: string;
  size: number;
  logPrefix: string;
  dependencies: {
    decryptAttachmentV2ToSink: typeof decryptAttachmentV2ToSink;
    encryptAndUploadAttachment: typeof encryptAndUploadAttachment;
  };
};

type UploadResponseType = {
  cdnKey: string;
  cdnNumber: number;
  encrypted: EncryptedAttachmentV2;
};
async function uploadToTransitTier({
  absolutePath,
  keys,
  version,
  localKey,
  size,
  iv,
  digest,
  logPrefix,
  dependencies,
}: UploadToTransitTierArgsType): Promise<UploadResponseType> {
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
            idForLogging: 'uploadToTransitTier',
            ciphertextPath: absolutePath,
            keysBase64: localKey,
            size,
            type: 'local',
          },
          sink
        ),
        dependencies.encryptAndUploadAttachment({
          plaintext: { stream: sink },
          keys: fromBase64(keys),
          dangerousIv: {
            reason: 'reencrypting-for-backup',
            iv: fromBase64(iv),
            digestToMatch: fromBase64(digest),
          },
          uploadType: 'backup',
        }),
      ]);

      return result;
    }

    // Legacy attachments
    return dependencies.encryptAndUploadAttachment({
      plaintext: { absolutePath },
      keys: fromBase64(keys),
      dangerousIv: {
        reason: 'reencrypting-for-backup',
        iv: fromBase64(iv),
        digestToMatch: fromBase64(digest),
      },
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
  iv,
  dependencies,
}: {
  cdnNumber: number;
  cdnKey: string;
  size: number;
  mediaId: string;
  macKey: Uint8Array;
  aesKey: Uint8Array;
  iv: Uint8Array;
  dependencies: {
    backupMediaBatch?: WebAPIType['backupMediaBatch'];
    backupsService: BackupsService;
  };
}): Promise<{ cdnNumberOnBackup: number }> {
  strictAssert(
    dependencies.backupMediaBatch,
    'backupMediaBatch must be intialized'
  );
  const ciphertextLength = getAttachmentCiphertextLength(size);

  const { responses } = await dependencies.backupMediaBatch({
    headers: await dependencies.backupsService.credentials.getHeadersForToday(),
    items: [
      {
        sourceAttachment: {
          cdn: cdnNumber,
          key: cdnKey,
        },
        objectLength: ciphertextLength,
        mediaId,
        hmacKey: macKey,
        encryptionKey: aesKey,
        iv,
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
  const sizeOnBackupCdn = getAesCbcCiphertextLength(ciphertextLength);
  await window.Signal.Data.saveBackupCdnObjectMetadata([
    { mediaId, cdnNumber: response.cdn, sizeOnBackupCdn },
  ]);

  return {
    cdnNumberOnBackup: response.cdn,
  };
}
