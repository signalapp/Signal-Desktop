import { v4 } from 'uuid';
import { sleepFor } from '../../Promise';
import { ConfigurationSyncPersistedData, PersistedJob } from '../PersistedJob';

const defaultMsBetweenRetries = 3000;

export class ConfigurationSyncJob extends PersistedJob<ConfigurationSyncPersistedData> {
  constructor({
    identifier,
    nextAttemptTimestamp,
    maxAttempts,
    currentRetry,
  }: Pick<ConfigurationSyncPersistedData, 'identifier' | 'currentRetry' | 'maxAttempts'> &
    Partial<Pick<ConfigurationSyncPersistedData, 'nextAttemptTimestamp'>>) {
    super({
      jobType: 'ConfigurationSyncJobType',
      identifier: identifier || v4(),
      delayBetweenRetries: defaultMsBetweenRetries,
      maxAttempts: maxAttempts,
      nextAttemptTimestamp: nextAttemptTimestamp || Date.now() + defaultMsBetweenRetries,
      currentRetry,
    });
  }

  public async run() {
    // blablha do everything from the notion page, and if success, return true.
    window.log.warn(
      `running job ${this.persistedData.jobType} with id:"${this.persistedData.identifier}" `
    );

    await sleepFor(5000);
    window.log.warn(
      `running job ${this.persistedData.jobType} with id:"${this.persistedData.identifier}" done and returning failed `
    );

    return false;
  }

  public serializeJob(): ConfigurationSyncPersistedData {
    const fromParent = super.serializeBase();
    return fromParent;
  }

  public addJobCheck(
    jobs: Array<ConfigurationSyncPersistedData>
  ): 'skipAsJobTypeAlreadyPresent' | 'removeJobsFromQueue' | null {
    return this.addJobCheckSameTypePresent(jobs);
  }

  /**
   * For the SharedConfig job, we do not care about the jobs already in the list.
   * We never want to add a new sync configuration job if there is already one in the queue.
   * This is done by the `addJobCheck` method above
   */
  public nonRunningJobsToRemove(_jobs: Array<ConfigurationSyncPersistedData>) {
    return [];
  }
}
