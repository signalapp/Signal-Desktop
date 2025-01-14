// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import * as z from 'zod';
import { MINUTE, SECOND } from '../util/durations';
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
import { sleep } from '../util/sleep';

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
  saveJob: (
    job: JobType,
    options?: { allowBatching?: boolean }
  ) => Promise<void>;
  removeJob: (job: JobType) => Promise<void>;
  runJob: (
    job: JobType,
    options: {
      abortSignal: AbortSignal;
      isLastAttempt: boolean;
    }
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
  | { status: 'finished'; newJob?: CoreJobType }
  | { status: 'rate-limited'; pauseDurationMs: number };

export type ActiveJobData<CoreJobType> = {
  completionPromise: ExplodePromiseResultType<void>;
  abortController: AbortController;
  job: CoreJobType & JobManagerJobType;
};

export abstract class JobManager<CoreJobType> {
  #enabled: boolean = false;
  #activeJobs: Map<string, ActiveJobData<CoreJobType>> = new Map();
  #jobStartPromises: Map<string, ExplodePromiseResultType<void>> = new Map();
  #jobCompletePromises: Map<string, ExplodePromiseResultType<void>> = new Map();
  #tickTimeout: NodeJS.Timeout | null = null;
  #idleCallbacks = new Array<() => void>();

  protected logPrefix = 'JobManager';
  public tickInterval = DEFAULT_TICK_INTERVAL;
  constructor(readonly params: JobManagerParamsType<CoreJobType>) {}

  async start(): Promise<void> {
    log.info(`${this.logPrefix}: starting`);
    if (!this.#enabled) {
      this.#enabled = true;
      await this.params.markAllJobsInactive();
    }
    await this.maybeStartJobs();
    this.#tick();
  }

  async stop(): Promise<void> {
    const activeJobs = [...this.#activeJobs.values()];

    log.info(
      `${this.logPrefix}: stopping. There are ` +
        `${activeJobs.length} active job(s)`
    );

    this.#enabled = false;
    clearTimeoutIfNecessary(this.#tickTimeout);
    this.#tickTimeout = null;
    await Promise.all(
      activeJobs.map(async ({ abortController, completionPromise }) => {
        abortController.abort();
        await completionPromise.promise;
      })
    );
  }

  async waitForIdle(): Promise<void> {
    if (this.#activeJobs.size === 0) {
      return;
    }

    await new Promise<void>(resolve => this.#idleCallbacks.push(resolve));
  }

  #tick(): void {
    clearTimeoutIfNecessary(this.#tickTimeout);
    this.#tickTimeout = null;
    drop(this.maybeStartJobs());
    this.#tickTimeout = setTimeout(() => this.#tick(), this.tickInterval);
  }

  #pauseForDuration(durationMs: number): void {
    this.#enabled = false;
    clearTimeoutIfNecessary(this.#tickTimeout);
    this.#tickTimeout = setTimeout(() => {
      this.#enabled = true;
      this.#tick();
    }, durationMs);
  }

  // used in testing
  waitForJobToBeStarted(
    job: CoreJobType & Pick<JobManagerJobType, 'attempts'>
  ): Promise<void> {
    const id = this.#getJobIdIncludingAttempts(job);
    const existingPromise = this.#jobStartPromises.get(id)?.promise;
    if (existingPromise) {
      return existingPromise;
    }
    const { promise, resolve, reject } = explodePromise<void>();
    this.#jobStartPromises.set(id, { promise, resolve, reject });
    return promise;
  }

  waitForJobToBeCompleted(
    job: CoreJobType & Pick<JobManagerJobType, 'attempts'>
  ): Promise<void> {
    const id = this.#getJobIdIncludingAttempts(job);
    const existingPromise = this.#jobCompletePromises.get(id)?.promise;
    if (existingPromise) {
      return existingPromise;
    }
    const { promise, resolve, reject } = explodePromise<void>();
    this.#jobCompletePromises.set(id, { promise, resolve, reject });
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
      const runningJob = this.#getRunningJob(job);
      if (runningJob) {
        log.info(`${logId}: already running; resetting attempts`);
        runningJob.attempts = 0;

        await this.params.saveJob({
          ...runningJob,
          attempts: 0,
        });

        return { isAlreadyRunning: true };
      }

      // Allow batching of all saves except those that we will start immediately
      await this.params.saveJob(job, { allowBatching: !options?.forceStart });

      if (options?.forceStart) {
        if (!this.#enabled) {
          log.warn(
            `${logId}: added but jobManager not enabled, can't start immediately`
          );
        } else {
          log.info(`${logId}: starting job immediately`);
          drop(this.startJob(job));
        }
      } else if (this.#enabled) {
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
  #_inMaybeStartJobs = false;

  protected async maybeStartJobs(): Promise<void> {
    if (this.#_inMaybeStartJobs) {
      return;
    }

    try {
      this.#_inMaybeStartJobs = true;
      if (!this.#enabled) {
        log.info(`${this.logPrefix}/_maybeStartJobs: not enabled, returning`);
        return;
      }

      const numJobsToStart = this.#getMaximumNumberOfJobsToStart();

      if (numJobsToStart <= 0) {
        return;
      }

      const nextJobs = await this.params.getNextJobs({
        limit: numJobsToStart,
        timestamp: Date.now(),
      });

      if (nextJobs.length === 0 && this.#activeJobs.size === 0) {
        if (this.#idleCallbacks.length > 0) {
          const callbacks = this.#idleCallbacks;
          this.#idleCallbacks = [];
          for (const callback of callbacks) {
            callback();
          }
        }
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
      this.#_inMaybeStartJobs = false;
    }
  }

  protected async startJob(
    job: CoreJobType & JobManagerJobType
  ): Promise<void> {
    const logId = `${this.logPrefix}/startJob(${this.params.getJobIdForLogging(
      job
    )})`;
    if (this.#isJobRunning(job)) {
      log.info(`${logId}: job is already running`);
      return;
    }

    const isLastAttempt =
      job.attempts + 1 >=
      (this.params.getRetryConfig(job).maxAttempts ?? Infinity);

    let jobRunResult: JobManagerJobResultType<CoreJobType> | undefined;
    try {
      log.info(`${logId}: starting job`);
      const { abortController } = this.#addRunningJob(job);
      await this.params.saveJob({ ...job, active: true });
      const runJobPromise = this.params.runJob(job, {
        abortSignal: abortController.signal,
        isLastAttempt,
      });
      this.#handleJobStartPromises(job);
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
          await this.#retryJobLater(job);
          return;
        case 'rate-limited':
          log.info(
            `${logId}: rate-limited; retrying in ${jobRunResult.pauseDurationMs}`
          );
          this.#pauseForDuration(jobRunResult.pauseDurationMs);
          await this.#retryJobLater(job);
          return;
        default:
          throw missingCaseError(status);
      }
    } catch (e) {
      log.error(`${logId}: error when running job`, e);
      if (isLastAttempt) {
        await this.params.removeJob(job);
      } else {
        await this.#retryJobLater(job);
      }
    } finally {
      this.#removeRunningJob(job);
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

  async #retryJobLater(job: CoreJobType & JobManagerJobType) {
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

  #getActiveJobCount(): number {
    return this.#activeJobs.size;
  }

  #getMaximumNumberOfJobsToStart(): number {
    return Math.max(
      0,
      this.params.maxConcurrentJobs - this.#getActiveJobCount()
    );
  }

  #getRunningJob(
    job: CoreJobType & JobManagerJobType
  ): (CoreJobType & JobManagerJobType) | undefined {
    const id = this.params.getJobId(job);
    return this.#activeJobs.get(id)?.job;
  }

  #isJobRunning(job: CoreJobType & JobManagerJobType): boolean {
    return Boolean(this.#getRunningJob(job));
  }

  #removeRunningJob(job: CoreJobType & JobManagerJobType) {
    const idWithAttempts = this.#getJobIdIncludingAttempts(job);
    this.#jobCompletePromises.get(idWithAttempts)?.resolve();
    this.#jobCompletePromises.delete(idWithAttempts);

    const id = this.params.getJobId(job);
    this.#activeJobs.get(id)?.completionPromise.resolve();
    this.#activeJobs.delete(id);
  }

  public async cancelJobs(
    predicate: (job: CoreJobType & JobManagerJobType) => boolean
  ): Promise<void> {
    const logId = `${this.logPrefix}/cancelJobs`;
    const jobs = Array.from(this.#activeJobs.values()).filter(data =>
      predicate(data.job)
    );

    if (jobs.length === 0) {
      log.warn(`${logId}: found no target jobs`);
      return;
    }

    await Promise.all(
      jobs.map(async jobData => {
        const { abortController, completionPromise, job } = jobData;

        abortController.abort();

        // First tell those waiting for the job that it's not happening
        const rejectionError = new Error('Cancelled at JobManager.cancelJobs');
        const idWithAttempts = this.#getJobIdIncludingAttempts(job);
        this.#jobCompletePromises.get(idWithAttempts)?.reject(rejectionError);
        this.#jobCompletePromises.delete(idWithAttempts);

        // Give the job 1 second to cancel itself
        await Promise.race([completionPromise.promise, sleep(SECOND)]);

        const jobId = this.params.getJobId(job);
        const hasCompleted = Boolean(this.#activeJobs.get(jobId));

        if (!hasCompleted) {
          const jobIdForLogging = this.params.getJobIdForLogging(job);
          log.warn(
            `${logId}: job ${jobIdForLogging} didn't complete; rejecting promises`
          );
          completionPromise.reject(rejectionError);
          this.#activeJobs.delete(jobId);
        }

        await this.params.removeJob(job);
      })
    );

    log.warn(`${logId}: Successfully cancelled ${jobs.length} jobs`);
  }

  #addRunningJob(
    job: CoreJobType & JobManagerJobType
  ): ActiveJobData<CoreJobType> {
    if (this.#isJobRunning(job)) {
      const jobIdForLogging = this.params.getJobIdForLogging(job);
      log.warn(
        `${this.logPrefix}/addRunningJob: job ${jobIdForLogging} is already running`
      );
    }

    const activeJob = {
      completionPromise: explodePromise<void>(),
      abortController: new AbortController(),
      job,
    };
    this.#activeJobs.set(this.params.getJobId(job), activeJob);

    return activeJob;
  }

  #handleJobStartPromises(job: CoreJobType & JobManagerJobType) {
    const id = this.#getJobIdIncludingAttempts(job);
    this.#jobStartPromises.get(id)?.resolve();
    this.#jobStartPromises.delete(id);
  }

  #getJobIdIncludingAttempts(
    job: CoreJobType & Pick<JobManagerJobType, 'attempts'>
  ) {
    return `${this.params.getJobId(job)}.${job.attempts}`;
  }
}
