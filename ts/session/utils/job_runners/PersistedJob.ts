import { isEmpty } from 'lodash';

export type PersistedJobType = 'ConfigurationSyncJobType';

export type SerializedPersistedJob = {
  // we  need at least those as they are needed to do lookups of the list of jobs.
  jobType: string;
  identifier: string;
  nextAttemptTimestamp: number;
  maxAttempts: number; // to run try to run it twice, set this to 2.
  currentRetry: number; //
  // then we can have other details on a specific type of job case
  [key: string]: any;
};

export abstract class Persistedjob {
  public readonly identifier: string;
  public readonly singleJobInQueue: boolean;
  public readonly delayBetweenRetries: number;
  public readonly maxAttempts: number;
  public readonly jobType: PersistedJobType;
  public currentRetry: number;
  public nextAttemptTimestamp: number;

  private runningPromise: Promise<boolean> | null = null;

  public constructor({
    maxAttempts,
    delayBetweenRetries,
    identifier,
    singleJobInQueue,
    jobType,
    nextAttemptTimestamp,
  }: {
    identifier: string;
    maxAttempts: number;
    delayBetweenRetries: number;
    singleJobInQueue: boolean;
    jobType: PersistedJobType;
    nextAttemptTimestamp: number;
    currentRetry: number;
  }) {
    this.identifier = identifier;
    this.jobType = jobType;
    this.delayBetweenRetries = delayBetweenRetries;
    this.maxAttempts = maxAttempts;
    this.currentRetry = 0;
    this.singleJobInQueue = singleJobInQueue;
    this.nextAttemptTimestamp = nextAttemptTimestamp;

    if (maxAttempts < 1) {
      throw new Error('maxAttempts must be >= 1');
    }

    if (isEmpty(identifier)) {
      throw new Error('identifier must be not empty');
    }

    if (isEmpty(jobType)) {
      throw new Error('identifier must be not empty');
    }

    if (delayBetweenRetries <= 0) {
      throw new Error('delayBetweenRetries must be at least > 0');
    }

    if (nextAttemptTimestamp <= 0) {
      throw new Error('nextAttemptTimestamp must be set and > 0');
    }
  }

  public async runJob() {
    if (!this.runningPromise) {
      this.runningPromise = this.run();
    }
    return this.runningPromise;
  }

  /**
   * If that job is running, wait for its completion (success or failure) before returning.
   * Can be used to wait for the task to be done before exiting the JobRunner
   */
  public async waitForCurrentTry() {
    // tslint:disable-next-line: no-promise-as-boolean
    return this.runningPromise || Promise.resolve();
  }

  /**
   * This one must be reimplemented in the child class, and must first call `super.serializeBase()`
   */
  public abstract serializeJob(): SerializedPersistedJob;

  protected abstract run(): Promise<boolean>; // must return true if that job is a success and doesn't need to be retried

  protected serializeBase(): SerializedPersistedJob {
    return {
      // those are mandatory
      jobType: this.jobType,
      identifier: this.identifier,
      nextAttemptTimestamp: this.nextAttemptTimestamp,
      maxAttempts: this.maxAttempts,
      currentRetry: this.currentRetry,
      delayBetweenRetries: this.delayBetweenRetries,
      singleJobInQueue: this.singleJobInQueue,
    };
  }
}
