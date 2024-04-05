import { isEmpty, isString } from 'lodash';
import {
  FakeSleepForJob,
  FakeSleepForMultiJob,
} from '../../../test/session/unit/utils/job_runner/FakeSleepForJob';
import { AvatarDownload } from './jobs/AvatarDownloadJob';
import { ConfigurationSync } from './jobs/ConfigurationSyncJob';
import { PersistedJob, TypeOfPersistedData } from './PersistedJob';

export function persistedJobFromData<T extends TypeOfPersistedData>(
  data: T
): PersistedJob<T> | null {
  if (!data || isEmpty(data.jobType) || !isString(data?.jobType)) {
    return null;
  }

  switch (data.jobType) {
    case 'ConfigurationSyncJobType':
      return new ConfigurationSync.ConfigurationSyncJob(data) as unknown as PersistedJob<T>;
    case 'AvatarDownloadJobType':
      return new AvatarDownload.AvatarDownloadJob(data) as unknown as PersistedJob<T>;
    case 'FakeSleepForJobType':
      return new FakeSleepForJob(data) as unknown as PersistedJob<T>;
    case 'FakeSleepForJobMultiType':
      return new FakeSleepForMultiJob(data) as unknown as PersistedJob<T>;
    default:
      window?.log?.error('unknown persisted job type:', (data as any).jobType);
      return null;
  }
}
