// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import PQueue from 'p-queue';
import { v7 as uuid } from 'uuid';
import { noop } from 'lodash';

import { Job } from './Job';
import { JobError } from './JobError';
import type { ParsedJob, StoredJob, JobQueueStore } from './types';
import { assertDev } from '../util/assert';
import * as log from '../logging/log';
import { JobLogger } from './JobLogger';
import * as Errors from '../types/errors';
import type { LoggerType } from '../types/Logging';
import { drop } from '../util/drop';
import { sleep } from '../util/sleep';
import { SECOND } from '../util/durations';

const noopOnCompleteCallbacks = {
  resolve: noop,
  reject: noop,
};

type JobQueueOptions = {
  /**
   * The backing store for jobs. Typically a wrapper around the database.
   */
  store: JobQueueStore;

  /**
   * A unique name for this job queue. For example, might be "attachment downloads" or
   * "message send".
   */
  queueType: string;

  /**
   * The maximum number of attempts for a job in this queue. A value of 1 will not allow
   * the job to fail; a value of 2 will allow the job to fail once; etc.
   */
  maxAttempts: number;

  /**
   * A custom logger. Might be overwritten in test.
   */
  logger?: LoggerType;
};

export enum JOB_STATUS {
  SUCCESS = 'SUCCESS',
  NEEDS_RETRY = 'NEEDS_RETRY',
  ERROR = 'ERROR',
}

export abstract class JobQueue<T> {
  readonly #maxAttempts: number;
  readonly #queueType: string;
  readonly #store: JobQueueStore;
  readonly #logger: LoggerType;
  readonly #logPrefix: string;
  #shuttingDown = false;
  #paused = false;

  readonly #onCompleteCallbacks = new Map<
    string,
    {
      resolve: () => void;
      reject: (err: unknown) => void;
    }
  >();

  readonly #defaultInMemoryQueue = new PQueue({ concurrency: 1 });
  #started = false;

  get isShuttingDown(): boolean {
    return this.#shuttingDown;
  }

  get isPaused(): boolean {
    return this.#paused;
  }

  constructor(options: Readonly<JobQueueOptions>) {
    assertDev(
      Number.isInteger(options.maxAttempts) && options.maxAttempts >= 1,
      'maxAttempts should be a positive integer'
    );
    assertDev(
      options.maxAttempts <= Number.MAX_SAFE_INTEGER,
      'maxAttempts is too large'
    );
    assertDev(
      options.queueType.trim().length,
      'queueType should be a non-blank string'
    );

    this.#maxAttempts = options.maxAttempts;
    this.#queueType = options.queueType;
    this.#store = options.store;
    this.#logger = options.logger ?? log;

    this.#logPrefix = `${this.#queueType} job queue:`;
  }

  /**
   * `parseData` will be called with the raw data from `store`. For example, if the job
   * takes a single number, `parseData` should throw if `data` is a number and should
   * return the number otherwise.
   *
   * If it throws, the job will be deleted from the database and the job will not be run.
   *
   * Will only be called once per job, even if `maxAttempts > 1`.
   */
  protected abstract parseData(data: unknown): T;

  /**
   * Run the job, given data.
   *
   * If it resolves, the job will be deleted from the store.
   *
   * If it rejects, the job will be retried up to `maxAttempts - 1` times, after which it
   * will be deleted from the store.
   *
   * If your job logs things, you're encouraged to use the logger provided, as it
   * automatically includes debugging information.
   */
  protected abstract run(
    job: Readonly<ParsedJob<T>>,
    extra?: Readonly<{ attempt?: number; log?: LoggerType }>
  ): Promise<JOB_STATUS.NEEDS_RETRY | undefined>;

  protected getQueues(): ReadonlySet<PQueue> {
    return new Set([this.#defaultInMemoryQueue]);
  }

  /**
   * Start streaming jobs from the store.
   */
  async streamJobs(): Promise<void> {
    if (this.#started) {
      throw new Error(
        `${this.#logPrefix} should not start streaming more than once`
      );
    }
    this.#started = true;

    log.info(`${this.#logPrefix} starting to stream jobs`);

    const stream = this.#store.stream(this.#queueType);
    for await (const storedJob of stream) {
      if (this.#shuttingDown) {
        log.info(
          `${this.#logPrefix} is shutting down. Can't accept more work.`
        );
        break;
      }
      if (this.#paused) {
        log.info(`${this.#logPrefix} is paused. Waiting until resume.`);
        while (this.#paused) {
          // eslint-disable-next-line no-await-in-loop
          await sleep(SECOND);
        }
        log.info(`${this.#logPrefix} has been resumed. Queuing job.`);
      }
      drop(this.enqueueStoredJob(storedJob));
    }
  }

  /**
   * Add a job, which should cause it to be enqueued and run.
   *
   * If `streamJobs` has not been called yet, this will throw an error.
   *
   * You can override `insert` to change the way the job is added to the database. This is
   * useful if you're trying to save a message and a job in the same database transaction.
   */
  async add(
    data: Readonly<T>,
    insert?: (job: ParsedJob<T>) => Promise<void>
  ): Promise<Job<T>> {
    const job = this.createJob(data);

    if (!this.#started) {
      log.warn(
        `${this.#logPrefix} This queue has not started streaming, adding job ${job.id} to database only.`
      );
    }

    if (insert) {
      await insert(job);
    }
    await this.#store.insert(job, { shouldPersist: !insert });

    log.info(`${this.#logPrefix} added new job ${job.id}`);
    return job;
  }

  protected createJob(data: Readonly<T>): Job<T> {
    const id = uuid();
    const timestamp = Date.now();

    const completionPromise = new Promise<void>((resolve, reject) => {
      this.#onCompleteCallbacks.set(id, { resolve, reject });
    });
    const completion = (async () => {
      try {
        await completionPromise;
      } catch (err: unknown) {
        throw new JobError(err);
      } finally {
        this.#onCompleteCallbacks.delete(id);
      }
    })();

    return new Job(id, timestamp, this.#queueType, data, completion);
  }

  protected getInMemoryQueue(_parsedJob: ParsedJob<T>): PQueue {
    return this.#defaultInMemoryQueue;
  }

  protected async enqueueStoredJob(
    storedJob: Readonly<StoredJob>
  ): Promise<void> {
    assertDev(
      storedJob.queueType === this.#queueType,
      'Received a mis-matched queue type'
    );

    log.info(`${this.#logPrefix} enqueuing job ${storedJob.id}`);

    // It's okay if we don't have a callback; that likely means the job was created before
    //   the process was started (e.g., from a previous run).
    const { resolve, reject } =
      this.#onCompleteCallbacks.get(storedJob.id) || noopOnCompleteCallbacks;

    let parsedData: T;
    try {
      parsedData = this.parseData(storedJob.data);
    } catch (err) {
      log.error(
        `${this.#logPrefix} failed to parse data for job ${storedJob.id}, created ${storedJob.timestamp}. Deleting job. Parse error:`,
        Errors.toLogFormat(err)
      );
      await this.#store.delete(storedJob.id);
      reject(
        new Error(
          'Failed to parse job data. Was unexpected data loaded from the database?'
        )
      );
      return;
    }

    const parsedJob: ParsedJob<T> = {
      ...storedJob,
      data: parsedData,
    };

    const queue: PQueue = this.getInMemoryQueue(parsedJob);

    const logger = new JobLogger(parsedJob, this.#logger);

    const result:
      | undefined
      | { status: JOB_STATUS.SUCCESS }
      | { status: JOB_STATUS.NEEDS_RETRY }
      | { status: JOB_STATUS.ERROR; err: unknown } = await queue.add(
      async () => {
        for (let attempt = 1; attempt <= this.#maxAttempts; attempt += 1) {
          const isFinalAttempt = attempt === this.#maxAttempts;

          logger.attempt = attempt;

          log.info(
            `${this.#logPrefix} running job ${storedJob.id}, attempt ${attempt} of ${this.#maxAttempts}`
          );

          if (this.isShuttingDown) {
            log.warn(
              `${this.#logPrefix} returning early for job ${storedJob.id}; shutting down`
            );
            return {
              status: JOB_STATUS.ERROR,
              err: new Error('Shutting down'),
            };
          }

          try {
            // We want an `await` in the loop, as we don't want a single job running more
            //   than once at a time. Ideally, the job will succeed on the first attempt.
            // eslint-disable-next-line no-await-in-loop
            const jobStatus = await this.run(parsedJob, {
              attempt,
              log: logger,
            });
            if (!jobStatus) {
              log.info(
                `${this.#logPrefix} job ${storedJob.id} succeeded on attempt ${attempt}`
              );
              return { status: JOB_STATUS.SUCCESS };
            }
            log.info(
              `${this.#logPrefix} job ${storedJob.id} returned status ${jobStatus} on attempt ${attempt}`
            );
            return { status: jobStatus };
          } catch (err: unknown) {
            log.error(
              `${this.#logPrefix} job ${
                storedJob.id
              } failed on attempt ${attempt}. ${Errors.toLogFormat(err)}`
            );
            if (isFinalAttempt) {
              return { status: JOB_STATUS.ERROR, err };
            }
          }
        }

        // This should never happen. See the assertion below.
        return undefined;
      }
    );

    if (result?.status === JOB_STATUS.NEEDS_RETRY) {
      const addJobSuccess = await this.retryJobOnQueueIdle({
        storedJob,
        job: parsedJob,
        logger,
      });
      if (!addJobSuccess) {
        await this.#store.delete(storedJob.id);
      }
    }
    if (
      result?.status === JOB_STATUS.SUCCESS ||
      (result?.status === JOB_STATUS.ERROR && !this.isShuttingDown)
    ) {
      await this.#store.delete(storedJob.id);
    }

    assertDev(
      result,
      'The job never ran. This indicates a developer error in the job queue'
    );
    if (result.status === JOB_STATUS.ERROR) {
      reject(result.err);
    } else {
      resolve();
    }
  }

  async retryJobOnQueueIdle({
    logger,
  }: {
    job: Readonly<ParsedJob<T>>;
    storedJob: Readonly<StoredJob>;
    logger: LoggerType;
  }): Promise<boolean> {
    logger.error(
      `retryJobOnQueueIdle: not implemented for queue ${this.#queueType}; dropping job`
    );
    return false;
  }

  async shutdown(): Promise<void> {
    const queues = this.getQueues();
    log.info(
      `${this.#logPrefix} shutdown: stop accepting new work and drain ${queues.size} promise queues`
    );
    this.#shuttingDown = true;
    await Promise.all([...queues].map(q => q.onIdle()));
    log.info(`${this.#logPrefix} shutdown: complete`);
  }

  pause(): void {
    log.info(`${this.#logPrefix}: pausing queue`);
    this.#paused = true;
  }

  resume(): void {
    log.info(`${this.#logPrefix}: resuming queue`);
    this.#paused = false;
  }
}
