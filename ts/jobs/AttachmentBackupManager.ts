// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable max-classes-per-file */

import { existsSync } from 'fs';

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
import { deriveBackupMediaKeyMaterial } from '../Crypto';
import { strictAssert } from '../util/assert';
import { type BackupsService, backupsService } from '../services/backups';
import {
  type EncryptedAttachmentV2,
  getAttachmentCiphertextLength,
  getAesCbcCiphertextLength,
  ReencyptedDigestMismatchError,
} from '../AttachmentCrypto';
import { getBackupKey } from '../services/backups/crypto';
import type {
  AttachmentBackupJobType,
  CoreAttachmentBackupJobType,
} from '../types/AttachmentBackup';
import { isInCall as isInCallSelector } from '../state/selectors/calling';
import { encryptAndUploadAttachment } from '../util/uploadAttachment';
import { getMediaIdFromMediaName } from '../services/backups/util/mediaId';
import { fromBase64 } from '../Bytes';
import type { WebAPIType } from '../textsecure/WebAPI';
import { mightStillBeOnTransitTier } from '../types/Attachment';

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
    getRetryConfig: () => RETRY_CONFIG,
    maxConcurrentJobs: MAX_CONCURRENT_JOBS,
  };

  override logPrefix = 'AttachmentBackupManager';

  static get instance(): AttachmentBackupManager {
    if (!AttachmentBackupManager._instance) {
      AttachmentBackupManager._instance = new AttachmentBackupManager(
        AttachmentBackupManager.defaultParams
      );
    }
    return AttachmentBackupManager._instance;
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
  return redactGenericText(job.mediaName);
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
  }
): Promise<JobManagerJobResultType> {
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

    if (error instanceof ReencyptedDigestMismatchError) {
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
  const logId = `AttachmentBackupManager.UploadOrCopyToBackupTier(mediaName:${jobIdForLogging})`;

  log.info(`${logId}: starting`);

  const { mediaName, type } = job;

  // TODO (DESKTOP-6913): generate & upload thumbnail
  strictAssert(
    type === 'standard',
    'Only standard uploads are currently supported'
  );

  const { path, transitCdnInfo, iv, digest, keys, size } = job.data;

  const mediaId = getMediaIdFromMediaName(mediaName);
  const backupKeyMaterial = deriveBackupMediaKeyMaterial(
    getBackupKey(),
    mediaId.bytes
  );

  const { isInBackupTier } = await dependencies.backupsService.getBackupCdnInfo(
    mediaId.string
  );

  if (isInBackupTier) {
    log.info(`${logId}: object already in backup tier, done`);
    return;
  }

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

type UploadResponseType = {
  cdnKey: string;
  cdnNumber: number;
  encrypted: EncryptedAttachmentV2;
};

async function uploadToTransitTier({
  absolutePath,
  keys,
  iv,
  digest,
  logPrefix,
  dependencies,
}: {
  absolutePath: string;
  iv: string;
  digest: string;
  keys: string;
  logPrefix: string;
  dependencies: {
    encryptAndUploadAttachment: typeof encryptAndUploadAttachment;
  };
}): Promise<UploadResponseType> {
  try {
    const uploadResult = await dependencies.encryptAndUploadAttachment({
      plaintext: { absolutePath },
      keys: fromBase64(keys),
      dangerousIv: {
        reason: 'reencrypting-for-backup',
        iv: fromBase64(iv),
        digestToMatch: fromBase64(digest),
      },
      uploadType: 'backup',
    });
    return uploadResult;
  } catch (error) {
    log.error(
      `${logPrefix}/uploadToTransitTier: Error while encrypting and uploading`,
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
