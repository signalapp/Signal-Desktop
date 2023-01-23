import { isEmpty, isString } from 'lodash';
import {
  FakeSleepForJob,
  FakeSleepForMultiJob,
} from '../../../test/session/unit/utils/job_runner/FakeSleepForJob';
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
    case 'FakeSleepForJobType':
      return new FakeSleepForJob({
        maxAttempts: data.maxAttempts,
        identifier: data.identifier,
        nextAttemptTimestamp: data.nextAttemptTimestamp,
        currentRetry: data.currentRetry,
      });
    case 'FakeSleepForJobMultiType':
      return new FakeSleepForMultiJob({
        maxAttempts: data.maxAttempts,
        identifier: data.identifier,
        nextAttemptTimestamp: data.nextAttemptTimestamp,
        currentRetry: data.currentRetry,
        returnResult: data.returnResult,
        sleepDuration: data.sleepDuration,
      });
    default:
      console.warn('unknown persisted job type:', jobType);
      return null;
  }
}
