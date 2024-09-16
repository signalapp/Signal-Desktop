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
import { calling } from '../services/calling';
import { callLinkFromRecord } from '../util/callLinksRingrtc';

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
  maxAttempts: Infinity,
  backoffConfig: {
    // 1 min, 5 min, 25 min, (max) 1 day
    multiplier: 5,
    firstBackoffs: [durations.MINUTE],
    maxBackoffTime: durations.DAY,
  },
};

type CallLinkDeleteManagerParamsType =
  JobManagerParamsType<CoreCallLinkDeleteJobType>;

function getJobId(job: CoreCallLinkDeleteJobType): string {
  return job.roomId;
}

export class CallLinkDeleteManager extends JobManager<CoreCallLinkDeleteJobType> {
  jobs: Map<string, CallLinkDeleteJobType> = new Map();
  private static _instance: CallLinkDeleteManager | undefined;
  override logPrefix = 'CallLinkDeleteManager';

  static defaultParams: CallLinkDeleteManagerParamsType = {
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

  constructor(params: CallLinkDeleteManagerParamsType) {
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

  static get instance(): CallLinkDeleteManager {
    if (!CallLinkDeleteManager._instance) {
      CallLinkDeleteManager._instance = new CallLinkDeleteManager(
        CallLinkDeleteManager.defaultParams
      );
    }
    return CallLinkDeleteManager._instance;
  }

  static async start(): Promise<void> {
    await CallLinkDeleteManager.instance.enqueueAllDeletedCallLinks();
    await CallLinkDeleteManager.instance.start();
  }

  static async stop(): Promise<void> {
    return CallLinkDeleteManager._instance?.stop();
  }

  static async addJob(
    newJob: CoreCallLinkDeleteJobType,
    options?: { delay: number }
  ): Promise<void> {
    return CallLinkDeleteManager.instance.addJob(newJob, options);
  }

  static async enqueueAllDeletedCallLinks(options?: {
    delay: number;
  }): Promise<void> {
    return CallLinkDeleteManager.instance.enqueueAllDeletedCallLinks(options);
  }
}

async function getNextJobs(
  this: CallLinkDeleteManager,
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
  this: CallLinkDeleteManager,
  job: CallLinkDeleteJobType
): Promise<void> {
  const { roomId } = job;
  this.jobs.set(roomId, job);
}

async function removeJob(
  this: CallLinkDeleteManager,
  job: CallLinkDeleteJobType
): Promise<void> {
  const logId = `CallLinkDeleteJobType/removeJob/${getJobId(job)}`;
  const { roomId } = job;
  await DataWriter.finalizeDeleteCallLink(job.roomId);
  log.info(`${logId}: Finalized local delete`);
  this.jobs.delete(roomId);
}

async function runJob(
  job: CallLinkDeleteJobType,
  _isLastAttempt: boolean
): Promise<JobManagerJobResultType<CoreCallLinkDeleteJobType>> {
  const logId = `CallLinkDeleteJobType/runJob/${getJobId(job)}`;

  const callLinkRecord = await DataReader.getCallLinkRecordByRoomId(job.roomId);
  if (callLinkRecord == null) {
    log.warn(`${logId}: Call link gone from DB`);
    return { status: 'finished' };
  }
  if (callLinkRecord.adminKey == null) {
    log.error(
      `${logId}: No admin key available, deletion on server not possible. Giving up.`
    );
    return { status: 'finished' };
  }

  // For consistency between devices, wait for storage sync
  if (callLinkRecord.storageNeedsSync !== 0) {
    log.info(`${logId}: Call link storage needs sync; retrying later`);
    return { status: 'retry' };
  }

  // Delete link on calling server. May 200 or 404 and both are OK.
  // Errs if call link is active or network is unavailable.
  const callLink = callLinkFromRecord(callLinkRecord);
  await calling.deleteCallLink(callLink);
  log.info(`${logId}: Deleted call link on server`);
  return { status: 'finished' };
}
