import { isNumber } from 'lodash';
import { v4 } from 'uuid';
import { sleepFor } from '../../../../../session/utils/Promise';
import {
  Persistedjob,
  SerializedPersistedJob,
} from '../../../../../session/utils/job_runners/PersistedJob';

export class FakeSleepForMultiJob extends Persistedjob {
  private readonly sleepDuration: number;
  private readonly returnResult: boolean;

  constructor({
    identifier,
    nextAttemptTimestamp,
    maxAttempts,
    currentRetry,
    returnResult,
    sleepDuration,
  }: {
    identifier: string | null;
    nextAttemptTimestamp: number | null;
    maxAttempts: number | null;
    currentRetry: number;
    sleepDuration: number;
    returnResult: boolean;
  }) {
    super({
      jobType: 'FakeSleepForJobMultiType',
      identifier: identifier || v4(),
      delayBetweenRetries: 10000,
      maxAttempts: isNumber(maxAttempts) ? maxAttempts : 3,
      nextAttemptTimestamp: nextAttemptTimestamp || Date.now() + 3000,
      singleJobInQueue: false,
      currentRetry,
    });
    this.returnResult = returnResult;
    this.sleepDuration = sleepDuration;
    if (process.env.NODE_APP_INSTANCE !== undefined) {
      throw new Error('FakeSleepForJobMultiType are only meant for testing purposes');
    }
  }

  public async run() {
    console.warn(
      `running job ${this.jobType} with id:"${this.identifier}". sleeping for ${this.sleepDuration} & returning ${this.returnResult} `
    );
    await sleepFor(this.sleepDuration);
    console.warn(`${this.jobType} with id:"${this.identifier}" done. returning success `);
    return this.returnResult;
  }

  public serializeJob(): SerializedPersistedJob {
    const fromParent = super.serializeBase();
    fromParent.sleepDuration = this.sleepDuration;
    fromParent.returnResult = this.returnResult;
    return fromParent;
  }
}

export class FakeSleepForJob extends Persistedjob {
  constructor({
    identifier,
    nextAttemptTimestamp,
    maxAttempts,
    currentRetry,
  }: {
    identifier: string | null;
    nextAttemptTimestamp: number | null;
    maxAttempts: number | null;
    currentRetry: number;
  }) {
    super({
      jobType: 'FakeSleepForJobType',
      identifier: identifier || v4(),
      delayBetweenRetries: 10000,
      maxAttempts: isNumber(maxAttempts) ? maxAttempts : 3,
      nextAttemptTimestamp: nextAttemptTimestamp || Date.now() + 3000,
      singleJobInQueue: true,
      currentRetry,
    });
    if (process.env.NODE_APP_INSTANCE !== undefined) {
      throw new Error('FakeSleepForJob are only meant for testing purposes');
    }
  }

  public async run() {
    console.warn(`running job ${this.jobType} with id:"${this.identifier}" `);
    await sleepFor(5000);
    console.warn(`${this.jobType} with id:"${this.identifier}" done. returning failed `);
    return false;
  }

  public serializeJob(): SerializedPersistedJob {
    const fromParent = super.serializeBase();
    return fromParent;
  }
}
