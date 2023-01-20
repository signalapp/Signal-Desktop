import { isEmpty, isString } from 'lodash';
import { ConfigurationSyncJob } from './jobs/ConfigurationSyncJob';
import { Persistedjob, PersistedJobType, SerializedPersistedJob } from './PersistedJob';

export function persistedJobFromData(data: SerializedPersistedJob): Persistedjob | null {
  if (!data || isEmpty(data.jobType) || !isString(data?.jobType)) {
    return null;
  }
  const jobType: PersistedJobType = data.jobType as PersistedJobType;
  switch (jobType) {
    case 'ConfigurationSyncJobType':
      return new ConfigurationSyncJob({
        maxAttempts: data.maxAttempts,
        identifier: data.identifier,
        nextAttemptTimestamp: data.nextAttemptTimestamp,
        currentRetry: data.currentRetry,
      });
    default:
      console.warn('unknown persisted job type:', jobType);
      return null;
  }
}
