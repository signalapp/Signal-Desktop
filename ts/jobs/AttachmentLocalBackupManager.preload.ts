// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable max-classes-per-file */

import { existsSync } from 'node:fs';
import { PassThrough } from 'node:stream';
import { constants as FS_CONSTANTS, copyFile, mkdir } from 'node:fs/promises';

import * as durations from '../util/durations/index.std.js';
import { createLogger } from '../logging/log.std.js';

import * as Errors from '../types/errors.std.js';
import { redactGenericText } from '../util/privacy.node.js';
import {
  getAbsoluteAttachmentPath,
  getAbsoluteAttachmentPath as doGetAbsoluteAttachmentPath,
} from '../util/migrations.preload.js';
import {
  JobManager,
  type JobManagerParamsType,
  type JobManagerJobResultType,
} from './JobManager.std.js';
import {
  type BackupsService,
  backupsService,
} from '../services/backups/index.preload.js';
import { decryptAttachmentV2ToSink } from '../AttachmentCrypto.node.js';
import {
  type AttachmentLocalBackupJobType,
  type CoreAttachmentLocalBackupJobType,
} from '../types/AttachmentBackup.std.js';
import { isInCall as isInCallSelector } from '../state/selectors/calling.std.js';
import { encryptAndUploadAttachment } from '../util/uploadAttachment.preload.js';
import { backupMediaBatch as doBackupMediaBatch } from '../textsecure/WebAPI.preload.js';
import {
  getLocalBackupDirectoryForMediaName,
  getLocalBackupPathForMediaName,
} from '../services/backups/util/localBackup.node.js';

const log = createLogger('AttachmentLocalBackupManager');

const MAX_CONCURRENT_JOBS = 3;
const RETRY_CONFIG = {
  maxAttempts: 3,
  backoffConfig: {
    // 1 minute, 5 minutes, 25 minutes, every hour
    multiplier: 3,
    firstBackoffs: [10 * durations.SECOND],
    maxBackoffTime: durations.MINUTE,
  },
};

export class AttachmentLocalBackupManager extends JobManager<CoreAttachmentLocalBackupJobType> {
  static #instance: AttachmentLocalBackupManager | undefined;
  readonly #jobsByMediaName = new Map<string, AttachmentLocalBackupJobType>();

  static defaultParams: JobManagerParamsType<CoreAttachmentLocalBackupJobType> =
    {
      markAllJobsInactive: AttachmentLocalBackupManager.markAllJobsInactive,
      saveJob: AttachmentLocalBackupManager.saveJob,
      removeJob: AttachmentLocalBackupManager.removeJob,
      getNextJobs: AttachmentLocalBackupManager.getNextJobs,
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

  override logPrefix = 'AttachmentLocalBackupManager';

  static get instance(): AttachmentLocalBackupManager {
    if (!AttachmentLocalBackupManager.#instance) {
      AttachmentLocalBackupManager.#instance = new AttachmentLocalBackupManager(
        AttachmentLocalBackupManager.defaultParams
      );
    }
    return AttachmentLocalBackupManager.#instance;
  }

  static get jobs(): Map<string, AttachmentLocalBackupJobType> {
    return AttachmentLocalBackupManager.instance.#jobsByMediaName;
  }

  static async start(): Promise<void> {
    log.info('starting');
    await AttachmentLocalBackupManager.instance.start();
  }

  static async stop(): Promise<void> {
    log.info('stopping');
    return AttachmentLocalBackupManager.#instance?.stop();
  }

  static async addJob(newJob: CoreAttachmentLocalBackupJobType): Promise<void> {
    return AttachmentLocalBackupManager.instance.addJob(newJob);
  }

  static async waitForIdle(): Promise<void> {
    return AttachmentLocalBackupManager.instance.waitForIdle();
  }

  static async markAllJobsInactive(): Promise<void> {
    for (const [mediaName, job] of AttachmentLocalBackupManager.jobs) {
      AttachmentLocalBackupManager.jobs.set(mediaName, {
        ...job,
        active: false,
      });
    }
  }

  static async saveJob(job: AttachmentLocalBackupJobType): Promise<void> {
    AttachmentLocalBackupManager.jobs.set(job.mediaName, job);
  }

  static async removeJob(
    job: Pick<AttachmentLocalBackupJobType, 'mediaName'>
  ): Promise<void> {
    AttachmentLocalBackupManager.jobs.delete(job.mediaName);
  }

  static clearAllJobs(): void {
    AttachmentLocalBackupManager.jobs.clear();
  }

  static async getNextJobs({
    limit,
    timestamp,
  }: {
    limit: number;
    timestamp: number;
  }): Promise<Array<AttachmentLocalBackupJobType>> {
    let countRemaining = limit;
    const nextJobs: Array<AttachmentLocalBackupJobType> = [];
    for (const job of AttachmentLocalBackupManager.jobs.values()) {
      if (job.active || (job.retryAfter && job.retryAfter > timestamp)) {
        continue;
      }

      nextJobs.push(job);
      countRemaining -= 1;
      if (countRemaining <= 0) {
        break;
      }
    }
    return nextJobs;
  }
}

function getJobId(job: CoreAttachmentLocalBackupJobType): string {
  return job.mediaName;
}

function getJobIdForLogging(job: CoreAttachmentLocalBackupJobType): string {
  return `${redactGenericText(job.mediaName)}`;
}

/**
 * Backup-specific methods
 */
class AttachmentPermanentlyMissingError extends Error {}

type RunAttachmentBackupJobDependenciesType = {
  getAbsoluteAttachmentPath: typeof doGetAbsoluteAttachmentPath;
  backupMediaBatch?: typeof doBackupMediaBatch;
  backupsService: BackupsService;
  encryptAndUploadAttachment: typeof encryptAndUploadAttachment;
  decryptAttachmentV2ToSink: typeof decryptAttachmentV2ToSink;
};

export async function runAttachmentBackupJob(
  job: AttachmentLocalBackupJobType,
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
): Promise<JobManagerJobResultType<CoreAttachmentLocalBackupJobType>> {
  const jobIdForLogging = getJobIdForLogging(job);
  const logId = `AttachmentLocalBackupManager/runAttachmentBackupJob/${jobIdForLogging}`;
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

    return { status: 'retry' };
  }
}

async function runAttachmentBackupJobInner(
  job: AttachmentLocalBackupJobType,
  dependencies: RunAttachmentBackupJobDependenciesType
): Promise<void> {
  const jobIdForLogging = getJobIdForLogging(job);
  const logId = `AttachmentLocalBackupManager.runAttachmentBackupJobInner(${jobIdForLogging})`;

  log.info(`${logId}: starting`);

  const { backupsBaseDir, mediaName } = job;
  const { localKey, path, size } = job.data;

  if (!path) {
    throw new AttachmentPermanentlyMissingError('No path property');
  }

  const absolutePath = dependencies.getAbsoluteAttachmentPath(path);
  if (!existsSync(absolutePath)) {
    throw new AttachmentPermanentlyMissingError('No file at provided path');
  }

  if (!localKey) {
    throw new Error('No localKey property, required for test decryption');
  }

  const localBackupFileDir = getLocalBackupDirectoryForMediaName({
    backupsBaseDir,
    mediaName,
  });
  await mkdir(localBackupFileDir, { recursive: true });

  const localBackupFilePath = getLocalBackupPathForMediaName({
    backupsBaseDir,
    mediaName,
  });

  // TODO: Add check in local FS to prevent double backup

  // File is already encrypted with localKey, so we just have to copy it to the backup dir
  const attachmentPath = getAbsoluteAttachmentPath(path);

  // Set COPYFILE_FICLONE for Copy on Write (OS dependent, gracefully falls back to copy)
  await copyFile(
    attachmentPath,
    localBackupFilePath,
    FS_CONSTANTS.COPYFILE_FICLONE
  );

  // TODO: Optimize this check -- it can be expensive to test decrypt on every export
  log.info(`${logId}: Verifying file in local backup`);
  const sink = new PassThrough();
  sink.resume();
  await decryptAttachmentV2ToSink(
    {
      ciphertextPath: localBackupFilePath,
      idForLogging: 'AttachmentLocalBackupManager',
      keysBase64: localKey,
      size,
      type: 'local',
    },
    sink
  );
}
