// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { v4 as uuid } from 'uuid';
import { noop } from 'lodash';

import { Job } from './Job';
import { JobError } from './JobError';
import { ParsedJob, StoredJob, JobQueueStore } from './types';
import { assert } from '../util/assert';
import * as log from '../logging/log';

const noopOnCompleteCallbacks = {
  resolve: noop,
  reject: noop,
};

type JobQueueOptions<T> = {
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
   * `parseData` will be called with the raw data from `store`. For example, if the job
   * takes a single number, `parseData` should throw if `data` is a number and should
   * return the number otherwise.
   *
   * If it throws, the job will be deleted from the store and the job will not be run.
   *
   * Will only be called once per job, even if `maxAttempts > 1`.
   */
  parseData: (data: unknown) => T;

  /**
   * Run the job, given data.
   *
   * If it resolves, the job will be deleted from the store.
   *
   * If it rejects, the job will be retried up to `maxAttempts - 1` times, after which it
   * will be deleted from the store.
   */
  run: (job: Readonly<ParsedJob<T>>) => Promise<void>;
};

export class JobQueue<T> {
  private readonly maxAttempts: number;

  private readonly parseData: (data: unknown) => T;

  private readonly queueType: string;

  private readonly run: (job: Readonly<ParsedJob<T>>) => Promise<unknown>;

  private readonly store: JobQueueStore;

  private readonly logPrefix: string;

  private readonly onCompleteCallbacks = new Map<
    string,
    {
      resolve: () => void;
      reject: (err: unknown) => void;
    }
  >();

  private started = false;

  constructor(options: Readonly<JobQueueOptions<T>>) {
    assert(
      Number.isInteger(options.maxAttempts) && options.maxAttempts >= 1,
      'maxAttempts should be a positive integer'
    );
    assert(
      options.maxAttempts <= Number.MAX_SAFE_INTEGER,
      'maxAttempts is too large'
    );
    assert(
      options.queueType.trim().length,
      'queueType should be a non-blank string'
    );

    this.maxAttempts = options.maxAttempts;
    this.parseData = options.parseData;
    this.queueType = options.queueType;
    this.run = options.run;
    this.store = options.store;

    this.logPrefix = `${this.queueType} job queue:`;
  }

  /**
   * Start streaming jobs from the store.
   */
  async streamJobs(): Promise<void> {
    if (this.started) {
      throw new Error(
        `${this.logPrefix} should not start streaming more than once`
      );
    }
    this.started = true;

    log.info(`${this.logPrefix} starting to stream jobs`);

    const stream = this.store.stream(this.queueType);
    // We want to enqueue the jobs in sequence, not in parallel. `for await ... of` is a
    //   good way to do that.
    // eslint-disable-next-line no-restricted-syntax
    for await (const storedJob of stream) {
      this.enqueueStoredJob(storedJob);
    }
  }

  /**
   * Add a job, which should cause it to be enqueued and run.
   *
   * If `streamJobs` has not been called yet, it will be called.
   */
  async add(data: Readonly<T>): Promise<Job<T>> {
    if (!this.started) {
      throw new Error(
        `${this.logPrefix} has not started streaming. Make sure to call streamJobs().`
      );
    }

    const id = uuid();
    const timestamp = Date.now();

    const completionPromise = new Promise<void>((resolve, reject) => {
      this.onCompleteCallbacks.set(id, { resolve, reject });
    });
    const completion = (async () => {
      try {
        await completionPromise;
      } catch (err: unknown) {
        throw new JobError(err);
      } finally {
        this.onCompleteCallbacks.delete(id);
      }
    })();

    log.info(`${this.logPrefix} added new job ${id}`);

    const job = new Job(id, timestamp, this.queueType, data, completion);
    await this.store.insert(job);
    return job;
  }

  private async enqueueStoredJob(storedJob: Readonly<StoredJob>) {
    assert(
      storedJob.queueType === this.queueType,
      'Received a mis-matched queue type'
    );

    log.info(`${this.logPrefix} enqueuing job ${storedJob.id}`);

    // It's okay if we don't have a callback; that likely means the job was created before
    //   the process was started (e.g., from a previous run).
    const { resolve, reject } =
      this.onCompleteCallbacks.get(storedJob.id) || noopOnCompleteCallbacks;

    let parsedData: T;
    try {
      parsedData = this.parseData(storedJob.data);
    } catch (err) {
      log.error(
        `${this.logPrefix} failed to parse data for job ${storedJob.id}`
      );
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

    let result:
      | undefined
      | { success: true }
      | { success: false; err: unknown };

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      log.info(
        `${this.logPrefix} running job ${storedJob.id}, attempt ${attempt} of ${this.maxAttempts}`
      );
      try {
        // We want an `await` in the loop, as we don't want a single job running more
        //   than once at a time. Ideally, the job will succeed on the first attempt.
        // eslint-disable-next-line no-await-in-loop
        await this.run(parsedJob);
        result = { success: true };
        log.info(
          `${this.logPrefix} job ${storedJob.id} succeeded on attempt ${attempt}`
        );
        break;
      } catch (err: unknown) {
        result = { success: false, err };
        log.error(
          `${this.logPrefix} job ${storedJob.id} failed on attempt ${attempt}`
        );
      }
    }

    await this.store.delete(storedJob.id);

    assert(
      result,
      'The job never ran. This indicates a developer error in the job queue'
    );
    if (result.success) {
      resolve();
    } else {
      reject(result.err);
    }
  }
}
