// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import * as durations from '../util/durations';
import * as log from '../logging/log';
import { DataReader, DataWriter } from '../sql/Client';
import {
  JobManager,
  type JobManagerParamsType,
  type JobManagerJobResultType,
  type JobManagerJobType,
} from './JobManager';

// Type for adding a new job
export type NewCallLinkDeleteJobType = {
  roomId: string;
  options?: { delay: number };
};

export type CoreCallLinkDeleteJobType = {
  roomId: string;
};

export type CallLinkDeleteJobType = CoreCallLinkDeleteJobType &
  JobManagerJobType;

const MAX_CONCURRENT_JOBS = 5;

const DEFAULT_RETRY_CONFIG = {
  maxAttempts: 10,
  backoffConfig: {
    // 1 min, 5 min, 25 min, (max) 1 day
    multiplier: 5,
    firstBackoffs: [durations.MINUTE],
    maxBackoffTime: durations.DAY,
  },
};

type CallLinkFinalizeDeleteManagerParamsType =
  JobManagerParamsType<CoreCallLinkDeleteJobType>;

function getJobId(job: CoreCallLinkDeleteJobType): string {
  return job.roomId;
}

// The purpose of this job is to finalize local DB delete of call links and
// associated call history, after we confirm storage sync.
// It does *not* delete the call link from the server -- this should be done
// synchronously and prior to running this job, so we can show confirmation
// or error to the user.
export class CallLinkFinalizeDeleteManager extends JobManager<CoreCallLinkDeleteJobType> {
  jobs: Map<string, CallLinkDeleteJobType> = new Map();
  private static _instance: CallLinkFinalizeDeleteManager | undefined;
  override logPrefix = 'CallLinkFinalizeDeleteManager';

  static defaultParams: CallLinkFinalizeDeleteManagerParamsType = {
    markAllJobsInactive: () => Promise.resolve(),
    getNextJobs,
    saveJob,
    removeJob,
    runJob,
    getJobId,
    getJobIdForLogging: getJobId,
    getRetryConfig: () => DEFAULT_RETRY_CONFIG,
    maxConcurrentJobs: MAX_CONCURRENT_JOBS,
  };

  constructor(params: CallLinkFinalizeDeleteManagerParamsType) {
    super({
      ...params,
      getNextJobs: ({ limit, timestamp }) =>
        params.getNextJobs.call(this, { limit, timestamp }),
      saveJob: (job: CallLinkDeleteJobType) => params.saveJob.call(this, job),
      removeJob: (job: CallLinkDeleteJobType) =>
        params.removeJob.call(this, job),
    });
  }

  override async addJob(
    jobData: CoreCallLinkDeleteJobType,
    options?: { delay: number }
  ): Promise<void> {
    const { delay } = options || {};
    if (delay) {
      log.info(
        `CallLinkDeleteJobType/addJob/${getJobId(jobData)}: Adding with delay ${delay}`
      );
      const job: CallLinkDeleteJobType = {
        ...jobData,
        attempts: 0,
        retryAfter: Date.now() + delay,
        lastAttemptTimestamp: null,
        active: false,
      };
      await this.params.saveJob(job);
      return;
    }

    await this._addJob(jobData);
  }

  async enqueueAllDeletedCallLinks(options?: { delay: number }): Promise<void> {
    const roomIds = await DataReader.getAllMarkedDeletedCallLinkRoomIds();
    log.info(
      `CallLinkDeleteJobType/enqueueAllDeletedCallLinks: Found ${roomIds.length} call links to delete`
    );
    roomIds.forEach(roomId => this.addJob({ roomId }, options));
  }

  static get instance(): CallLinkFinalizeDeleteManager {
    if (!CallLinkFinalizeDeleteManager._instance) {
      CallLinkFinalizeDeleteManager._instance =
        new CallLinkFinalizeDeleteManager(
          CallLinkFinalizeDeleteManager.defaultParams
        );
    }
    return CallLinkFinalizeDeleteManager._instance;
  }

  static async start(): Promise<void> {
    await CallLinkFinalizeDeleteManager.instance.enqueueAllDeletedCallLinks();
    await CallLinkFinalizeDeleteManager.instance.start();
  }

  static async stop(): Promise<void> {
    return CallLinkFinalizeDeleteManager._instance?.stop();
  }

  static async addJob(
    newJob: CoreCallLinkDeleteJobType,
    options?: { delay: number }
  ): Promise<void> {
    return CallLinkFinalizeDeleteManager.instance.addJob(newJob, options);
  }

  static async enqueueAllDeletedCallLinks(options?: {
    delay: number;
  }): Promise<void> {
    return CallLinkFinalizeDeleteManager.instance.enqueueAllDeletedCallLinks(
      options
    );
  }
}

async function getNextJobs(
  this: CallLinkFinalizeDeleteManager,
  {
    limit,
    timestamp,
  }: {
    limit: number;
    timestamp: number;
  }
): Promise<Array<CallLinkDeleteJobType>> {
  let countRemaining = limit;
  const nextJobs: Array<CallLinkDeleteJobType> = [];
  for (const job of this.jobs.values()) {
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

async function saveJob(
  this: CallLinkFinalizeDeleteManager,
  job: CallLinkDeleteJobType
): Promise<void> {
  const { roomId } = job;
  this.jobs.set(roomId, job);
}

async function removeJob(
  this: CallLinkFinalizeDeleteManager,
  job: CallLinkDeleteJobType
): Promise<void> {
  this.jobs.delete(job.roomId);
}

async function runJob(
  job: CallLinkDeleteJobType,
  _options: { isLastAttempt: boolean; abortSignal: AbortSignal }
): Promise<JobManagerJobResultType<CoreCallLinkDeleteJobType>> {
  const logId = `CallLinkDeleteJobType/runJob/${getJobId(job)}`;

  const callLinkRecord = await DataReader.getCallLinkRecordByRoomId(job.roomId);
  if (callLinkRecord == null) {
    log.warn(`${logId}: Call link gone from DB`);
    return { status: 'finished' };
  }
  if (callLinkRecord.deleted !== 1) {
    log.error(`${logId}: Call link not marked deleted. Giving up.`);
    return { status: 'finished' };
  }

  // For consistency between devices, wait for storage sync
  if (callLinkRecord.storageNeedsSync !== 0) {
    log.info(`${logId}: Call link storage needs sync; retrying later`);
    return { status: 'retry' };
  }

  await DataWriter.finalizeDeleteCallLink(job.roomId);
  log.info(`${logId}: Finalized local delete`);
  return { status: 'finished' };
}
