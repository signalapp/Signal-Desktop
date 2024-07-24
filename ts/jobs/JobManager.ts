// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import * as z from 'zod';
import { MINUTE } from '../util/durations';
import {
  explodePromise,
  type ExplodePromiseResultType,
} from '../util/explodePromise';
import { clearTimeoutIfNecessary } from '../util/clearTimeoutIfNecessary';
import { drop } from '../util/drop';
import * as log from '../logging/log';
import { missingCaseError } from '../util/missingCaseError';
import {
  type ExponentialBackoffOptionsType,
  exponentialBackoffSleepTime,
} from '../util/exponentialBackoff';
import * as Errors from '../types/errors';

export type JobManagerJobType = {
  active: boolean;
  attempts: number;
  retryAfter: number | null;
  lastAttemptTimestamp: number | null;
};

export const jobManagerJobSchema = z.object({
  attempts: z.number(),
  active: z.boolean(),
  retryAfter: z.number().nullable(),
  lastAttemptTimestamp: z.number().nullable(),
}) satisfies z.ZodType<JobManagerJobType>;

export type JobManagerParamsType<
  CoreJobType,
  JobType = CoreJobType & JobManagerJobType,
> = {
  markAllJobsInactive: () => Promise<void>;
  getNextJobs: (options: {
    limit: number;
    timestamp: number;
  }) => Promise<Array<JobType>>;
  saveJob: (job: JobType) => Promise<void>;
  removeJob: (job: JobType) => Promise<void>;
  runJob: (
    job: JobType,
    isLastAttempt: boolean
  ) => Promise<JobManagerJobResultType<CoreJobType>>;
  shouldHoldOffOnStartingQueuedJobs?: () => boolean;
  getJobId: (job: CoreJobType) => string;
  getJobIdForLogging: (job: JobType) => string;
  getRetryConfig: (job: JobType) => {
    maxAttempts: number;
    backoffConfig: ExponentialBackoffOptionsType;
  };
  maxConcurrentJobs: number;
};

const DEFAULT_TICK_INTERVAL = MINUTE;
export type JobManagerJobResultType<CoreJobType> =
  | {
      status: 'retry';
    }
  | { status: 'finished'; newJob?: CoreJobType };

export abstract class JobManager<CoreJobType> {
  protected enabled: boolean = false;
  protected activeJobs: Map<
    string,
    {
      completionPromise: ExplodePromiseResultType<void>;
      job: CoreJobType & JobManagerJobType;
    }
  > = new Map();
  protected jobStartPromises: Map<string, ExplodePromiseResultType<void>> =
    new Map();
  protected jobCompletePromises: Map<string, ExplodePromiseResultType<void>> =
    new Map();

  protected tickTimeout: NodeJS.Timeout | null = null;
  protected logPrefix = 'JobManager';
  public tickInterval = DEFAULT_TICK_INTERVAL;
  constructor(readonly params: JobManagerParamsType<CoreJobType>) {}

  async start(): Promise<void> {
    this.enabled = true;
    await this.params.markAllJobsInactive();
    this.tick();
  }

  async stop(): Promise<void> {
    this.enabled = false;
    clearTimeoutIfNecessary(this.tickTimeout);
    this.tickTimeout = null;
    await Promise.all(
      [...this.activeJobs.values()].map(
        ({ completionPromise }) => completionPromise.promise
      )
    );
  }

  tick(): void {
    clearTimeoutIfNecessary(this.tickTimeout);
    this.tickTimeout = null;
    drop(this.maybeStartJobs());
    this.tickTimeout = setTimeout(() => this.tick(), this.tickInterval);
  }

  // used in testing
  waitForJobToBeStarted(
    job: CoreJobType & Pick<JobManagerJobType, 'attempts'>
  ): Promise<void> {
    const id = this.getJobIdIncludingAttempts(job);
    const existingPromise = this.jobStartPromises.get(id)?.promise;
    if (existingPromise) {
      return existingPromise;
    }
    const { promise, resolve, reject } = explodePromise<void>();
    this.jobStartPromises.set(id, { promise, resolve, reject });
    return promise;
  }

  waitForJobToBeCompleted(
    job: CoreJobType & Pick<JobManagerJobType, 'attempts'>
  ): Promise<void> {
    const id = this.getJobIdIncludingAttempts(job);
    const existingPromise = this.jobCompletePromises.get(id)?.promise;
    if (existingPromise) {
      return existingPromise;
    }
    const { promise, resolve, reject } = explodePromise<void>();
    this.jobCompletePromises.set(id, { promise, resolve, reject });
    return promise;
  }

  async addJob(newJob: CoreJobType): Promise<void> {
    await this._addJob(newJob);
  }

  // Protected methods
  protected async _addJob(
    newJob: CoreJobType,
    options?: { forceStart: boolean }
  ): Promise<{ isAlreadyRunning: boolean }> {
    const job: CoreJobType & JobManagerJobType = {
      ...newJob,
      attempts: 0,
      retryAfter: null,
      lastAttemptTimestamp: null,
      active: false,
    };
    const logId = this.params.getJobIdForLogging(job);
    try {
      const runningJob = this.getRunningJob(job);
      if (runningJob) {
        log.info(`${logId}: already running; resetting attempts`);
        runningJob.attempts = 0;

        await this.params.saveJob({
          ...runningJob,
          attempts: 0,
        });

        return { isAlreadyRunning: true };
      }

      await this.params.saveJob(job);

      if (options?.forceStart) {
        if (!this.enabled) {
          log.warn(
            `${logId}: added but jobManager not enabled, can't start immediately`
          );
        } else {
          log.info(`${logId}: starting job immediately`);
          drop(this.startJob(job));
        }
      } else if (this.enabled) {
        drop(this.maybeStartJobs());
      }

      return { isAlreadyRunning: false };
    } catch (e) {
      log.error(`${logId}: error saving job`, Errors.toLogFormat(e));
      throw e;
    }
  }

  // maybeStartJobs is called:
  // 1. every minute (via tick)
  // 2. after a job is added (via addJob)
  // 3. after a job finishes (via startJob)
  // preventing re-entrancy allow us to simplify some logic and ensure we don't try to
  // start too many jobs
  private _inMaybeStartJobs = false;
  protected async maybeStartJobs(): Promise<void> {
    if (this._inMaybeStartJobs) {
      return;
    }

    try {
      this._inMaybeStartJobs = true;
      if (!this.enabled) {
        log.info(`${this.logPrefix}/_maybeStartJobs: not enabled, returning`);
        return;
      }

      const numJobsToStart = this.getMaximumNumberOfJobsToStart();

      if (numJobsToStart <= 0) {
        return;
      }

      const nextJobs = await this.params.getNextJobs({
        limit: numJobsToStart,
        timestamp: Date.now(),
      });

      if (nextJobs.length === 0) {
        return;
      }

      if (this.params.shouldHoldOffOnStartingQueuedJobs?.()) {
        log.info(
          `${this.logPrefix}/_maybeStartJobs: holding off on starting ${nextJobs.length} new job(s)`
        );
        return;
      }

      for (const job of nextJobs) {
        drop(this.startJob(job));
      }
    } finally {
      this._inMaybeStartJobs = false;
    }
  }

  protected async startJob(
    job: CoreJobType & JobManagerJobType
  ): Promise<void> {
    const logId = `${this.logPrefix}/startJob(${this.params.getJobIdForLogging(
      job
    )})`;
    if (this.isJobRunning(job)) {
      log.info(`${logId}: job is already running`);
      return;
    }

    const isLastAttempt =
      job.attempts + 1 >=
      (this.params.getRetryConfig(job).maxAttempts ?? Infinity);

    let jobRunResult: JobManagerJobResultType<CoreJobType> | undefined;
    try {
      log.info(`${logId}: starting job`);
      this.addRunningJob(job);
      await this.params.saveJob({ ...job, active: true });
      const runJobPromise = this.params.runJob(job, isLastAttempt);
      this.handleJobStartPromises(job);
      jobRunResult = await runJobPromise;
      const { status } = jobRunResult;
      log.info(`${logId}: job completed with status: ${status}`);

      switch (status) {
        case 'finished':
          await this.params.removeJob(job);
          return;
        case 'retry':
          if (isLastAttempt) {
            throw new Error('Cannot retry on last attempt');
          }
          await this.retryJobLater(job);
          return;
        default:
          throw missingCaseError(status);
      }
    } catch (e) {
      log.error(`${logId}: error when running job`, e);
      if (isLastAttempt) {
        await this.params.removeJob(job);
      } else {
        await this.retryJobLater(job);
      }
    } finally {
      this.removeRunningJob(job);
      if (jobRunResult?.status === 'finished') {
        if (jobRunResult.newJob) {
          log.info(
            `${logId}: adding new job as a result of this one completing`
          );
          await this.addJob(jobRunResult.newJob);
        }
      }
      drop(this.maybeStartJobs());
    }
  }

  private async retryJobLater(job: CoreJobType & JobManagerJobType) {
    const now = Date.now();
    await this.params.saveJob({
      ...job,
      active: false,
      attempts: job.attempts + 1,
      retryAfter:
        now +
        exponentialBackoffSleepTime(
          job.attempts + 1,
          this.params.getRetryConfig(job).backoffConfig
        ),
      lastAttemptTimestamp: now,
    });
  }

  private getActiveJobCount(): number {
    return this.activeJobs.size;
  }

  private getMaximumNumberOfJobsToStart(): number {
    return Math.max(
      0,
      this.params.maxConcurrentJobs - this.getActiveJobCount()
    );
  }

  private getRunningJob(
    job: CoreJobType & JobManagerJobType
  ): (CoreJobType & JobManagerJobType) | undefined {
    const id = this.params.getJobId(job);
    return this.activeJobs.get(id)?.job;
  }

  private isJobRunning(job: CoreJobType & JobManagerJobType): boolean {
    return Boolean(this.getRunningJob(job));
  }

  private removeRunningJob(job: CoreJobType & JobManagerJobType) {
    const idWithAttempts = this.getJobIdIncludingAttempts(job);
    this.jobCompletePromises.get(idWithAttempts)?.resolve();
    this.jobCompletePromises.delete(idWithAttempts);

    const id = this.params.getJobId(job);
    this.activeJobs.get(id)?.completionPromise.resolve();
    this.activeJobs.delete(id);
  }

  private addRunningJob(job: CoreJobType & JobManagerJobType) {
    if (this.isJobRunning(job)) {
      const jobIdForLogging = this.params.getJobIdForLogging(job);
      log.warn(
        `${this.logPrefix}/addRunningJob: job ${jobIdForLogging} is already running`
      );
    }
    this.activeJobs.set(this.params.getJobId(job), {
      completionPromise: explodePromise<void>(),
      job,
    });
  }

  private handleJobStartPromises(job: CoreJobType & JobManagerJobType) {
    const id = this.getJobIdIncludingAttempts(job);
    this.jobStartPromises.get(id)?.resolve();
    this.jobStartPromises.delete(id);
  }

  private getJobIdIncludingAttempts(
    job: CoreJobType & Pick<JobManagerJobType, 'attempts'>
  ) {
    return `${this.params.getJobId(job)}.${job.attempts}`;
  }
}
