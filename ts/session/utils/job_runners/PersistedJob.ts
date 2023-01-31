import { cloneDeep, isEmpty } from 'lodash';

export type PersistedJobType =
  | 'ConfigurationSyncJobType'
  | 'AvatarDownloadJobType'
  | 'FakeSleepForJobType'
  | 'FakeSleepForJobMultiType';

interface PersistedJobData {
  jobType: PersistedJobType;
  identifier: string;
  nextAttemptTimestamp: number;
  delayBetweenRetries: number;
  maxAttempts: number; // to try to run this job twice, set this to 2.
  currentRetry: number;
}

export interface FakeSleepJobData extends PersistedJobData {
  jobType: 'FakeSleepForJobType';
  returnResult: boolean;
  sleepDuration: number;
}
export interface FakeSleepForMultiJobData extends PersistedJobData {
  jobType: 'FakeSleepForJobMultiType';
  returnResult: boolean;
  sleepDuration: number;
}

export interface AvatarDownloadPersistedData extends PersistedJobData {
  jobType: 'AvatarDownloadJobType';
  conversationId: string;
  profileKeyHex: string | null;
  profilePictureUrl: string | null;
}

export interface ConfigurationSyncPersistedData extends PersistedJobData {
  jobType: 'ConfigurationSyncJobType';
}

export type TypeOfPersistedData =
  | ConfigurationSyncPersistedData
  | AvatarDownloadPersistedData
  | FakeSleepJobData
  | FakeSleepForMultiJobData;

export type AddJobCheckReturn =
  | 'skipAddSameJobPresent'
  | 'removeJobsFromQueue'
  | 'sameJobDataAlreadyInQueue'
  | null;

export enum RunJobResult {
  Success = 1,
  RetryJobIfPossible = 2,
  PermanentFailure = 3,
}

/**
 * This class can be used to save and run jobs from the database.
 * Every child class must take the minimum amount of arguments, and make sure they are unlikely to change.
 * For instance, don't have the attachments to downloads as arguments, just the messageId and the index.
 * Don't have the new profileImage url for an avatar download job, just the conversationId.
 *
 * It is the role of the job to fetch the latest data, and decide if a process is needed or not
 * If the job throws or returns false, it will be retried by the corresponding job runner.
 */
export abstract class PersistedJob<T extends PersistedJobData> {
  public persistedData: T;

  private runningPromise: Promise<RunJobResult> | null = null;

  public constructor(data: T) {
    if (data.maxAttempts < 1) {
      throw new Error('maxAttempts must be >= 1');
    }

    if (isEmpty(data.identifier)) {
      throw new Error('identifier must be not empty');
    }

    if (isEmpty(data.jobType)) {
      throw new Error('jobType must be not empty');
    }

    if (data.delayBetweenRetries <= 0) {
      throw new Error('delayBetweenRetries must be at least > 0');
    }

    if (data.nextAttemptTimestamp <= 0) {
      throw new Error('nextAttemptTimestamp must be set and > 0');
    }

    this.persistedData = data;
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
    try {
      // tslint:disable-next-line: no-promise-as-boolean
      return this.runningPromise || Promise.resolve(true);
    } catch (e) {
      window.log.warn('waitForCurrentTry got an error: ', e.message);
      return Promise.resolve(true);
    }
  }

  /**
   * This one must be reimplemented in the child class, and must first call `super.serializeBase()`
   */
  public abstract serializeJob(): T;

  public abstract nonRunningJobsToRemove(jobs: Array<T>): Array<T>;

  public abstract addJobCheck(jobs: Array<T>): AddJobCheckReturn;

  public addJobCheckSameTypePresent(jobs: Array<T>): 'skipAddSameJobPresent' | null {
    return jobs.some(j => j.jobType === this.persistedData.jobType)
      ? 'skipAddSameJobPresent'
      : null;
  }

  /**
   * This function will be called by the runner do run the logic of that job.
   * It **must** return true if that job is a success and doesn't need to be retried.
   * If it returns false, or throws, it will be retried (if not reach the retries limit yet).
   *
   * Note: you should check the this.isAborted() to know if you should cancel the current processing of your logic.
   */
  protected abstract run(): Promise<RunJobResult>;

  protected serializeBase(): T {
    return cloneDeep(this.persistedData);
  }
}
