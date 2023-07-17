import { isNumber } from 'lodash';
import { v4 } from 'uuid';
import { sleepFor } from '../../../../../session/utils/Promise';
import {
  AddJobCheckReturn,
  FakeSleepForMultiJobData,
  FakeSleepJobData,
  PersistedJob,
  RunJobResult,
} from '../../../../../session/utils/job_runners/PersistedJob';

export class FakeSleepForMultiJob extends PersistedJob<FakeSleepForMultiJobData> {
  constructor({
    identifier,
    nextAttemptTimestamp,
    maxAttempts,
    currentRetry,
    returnResult,
    sleepDuration,
  }: Pick<FakeSleepForMultiJobData, 'currentRetry' | 'returnResult' | 'sleepDuration'> &
    Partial<
      Pick<FakeSleepForMultiJobData, 'nextAttemptTimestamp' | 'maxAttempts' | 'identifier'>
    >) {
    super({
      jobType: 'FakeSleepForJobMultiType',
      identifier: identifier || v4(),
      delayBetweenRetries: 10000,
      maxAttempts: isNumber(maxAttempts) ? maxAttempts : 3,
      nextAttemptTimestamp: nextAttemptTimestamp || Date.now() + 3000,
      currentRetry,
      returnResult,
      sleepDuration,
    });
    if (process.env.NODE_APP_INSTANCE !== undefined) {
      throw new Error('FakeSleepForJobMultiType are only meant for testing purposes');
    }
  }

  public async run(): Promise<RunJobResult> {
    window.log.warn(
      `running job ${this.persistedData.jobType} with id:"${this.persistedData.identifier}". sleeping for ${this.persistedData.sleepDuration} & returning ${this.persistedData.returnResult} `
    );
    await sleepFor(this.persistedData.sleepDuration);
    window.log.warn(
      `${this.persistedData.jobType} with id:"${this.persistedData.identifier}" done. returning success `
    );
    if (this.persistedData.returnResult) {
      return RunJobResult.Success;
    }
    return RunJobResult.RetryJobIfPossible;
  }

  public serializeJob(): FakeSleepForMultiJobData {
    return super.serializeBase();
  }

  /**
   * For the fakesleep for multi, we want to allow as many job as we want, so this returns null
   */
  public addJobCheck(_jobs: Array<FakeSleepForMultiJobData>): AddJobCheckReturn {
    return null;
  }

  /**
   * For the MultiFakeSleep job, there are no jobs to remove if we try to add a new one of the same type.
   */
  public nonRunningJobsToRemove(_jobs: Array<FakeSleepForMultiJobData>) {
    return [];
  }

  public getJobTimeoutMs(): number {
    return 10000;
  }
}

export class FakeSleepForJob extends PersistedJob<FakeSleepJobData> {
  constructor({
    identifier,
    nextAttemptTimestamp,
    maxAttempts,
    currentRetry,
  }: Pick<FakeSleepJobData, 'currentRetry' | 'maxAttempts'> &
    Partial<Pick<FakeSleepJobData, 'nextAttemptTimestamp' | 'identifier'>>) {
    super({
      jobType: 'FakeSleepForJobType',
      identifier: identifier || v4(),
      delayBetweenRetries: 10000,
      maxAttempts,
      nextAttemptTimestamp: nextAttemptTimestamp || Date.now() + 3000,
      currentRetry,
      returnResult: false,
      sleepDuration: 5000,
    });
    if (process.env.NODE_APP_INSTANCE !== undefined) {
      throw new Error('FakeSleepForJob are only meant for testing purposes');
    }
  }

  public async run(): Promise<RunJobResult> {
    window.log.warn(
      `running job ${this.persistedData.jobType} with id:"${this.persistedData.identifier}" `
    );
    await sleepFor(this.persistedData.sleepDuration);
    window.log.warn(
      `${this.persistedData.jobType} with id:"${this.persistedData.identifier}" done. returning failed `
    );
    return RunJobResult.RetryJobIfPossible;
  }

  public serializeJob(): FakeSleepJobData {
    return super.serializeBase();
  }

  public addJobCheck(jobs: Array<FakeSleepJobData>): AddJobCheckReturn {
    return this.addJobCheckSameTypePresent(jobs);
  }

  /**
   * For the FakeSleep job, we do not care about the jobs already in the list.
   * We just never want to add a new job of that type if there is already one in the queue.
   * This is done by the `addJobCheck` method above
   */
  public nonRunningJobsToRemove(_jobs: Array<FakeSleepJobData>) {
    return [];
  }

  public getJobTimeoutMs(): number {
    return 10000;
  }
}
