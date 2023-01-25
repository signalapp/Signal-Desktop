import { isNumber } from 'lodash';
import { v4 } from 'uuid';
import { sleepFor } from '../../Promise';
import { Persistedjob, SerializedPersistedJob } from '../PersistedJob';

export class ConfigurationSyncJob extends Persistedjob {
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
      jobType: 'ConfigurationSyncJobType',
      identifier: identifier || v4(),
      delayBetweenRetries: 3000,
      maxAttempts: isNumber(maxAttempts) ? maxAttempts : 3,
      nextAttemptTimestamp: nextAttemptTimestamp || Date.now() + 3000,
      singleJobInQueue: true,
      currentRetry,
    });
  }

  public async run() {
    // blablha do everything from the notion page, and if success, return true.
    window.log.warn(`running job ${this.jobType} with id:"${this.identifier}" `);

    await sleepFor(5000);
    window.log.warn(
      `running job ${this.jobType} with id:"${this.identifier}" done and returning failed `
    );

    return false;
  }

  public serializeJob(): SerializedPersistedJob {
    const fromParent = super.serializeBase();
    return fromParent;
  }
}
