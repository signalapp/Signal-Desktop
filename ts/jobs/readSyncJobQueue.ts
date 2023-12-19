// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as durations from '../util/durations';
import type { LoggerType } from '../types/Logging';
import { exponentialBackoffMaxAttempts } from '../util/exponentialBackoff';
import type { SyncType } from './helpers/syncHelpers';
import {
  SyncTypeList,
  parseRawSyncDataArray,
  runSyncJob,
} from './helpers/syncHelpers';
import { strictAssert } from '../util/assert';
import { isRecord } from '../util/isRecord';

import type { JOB_STATUS } from './JobQueue';
import { JobQueue } from './JobQueue';
import { jobQueueDatabaseStore } from './JobQueueDatabaseStore';

const MAX_RETRY_TIME = durations.DAY;

export type ReadSyncJobData = {
  readSyncs: Array<SyncType>;
};

export class ReadSyncJobQueue extends JobQueue<ReadSyncJobData> {
  protected parseData(data: unknown): ReadSyncJobData {
    strictAssert(isRecord(data), 'data is not an object');
    return { readSyncs: parseRawSyncDataArray(data.readSyncs) };
  }

  protected async run(
    { data, timestamp }: Readonly<{ data: ReadSyncJobData; timestamp: number }>,
    { attempt, log }: Readonly<{ attempt: number; log: LoggerType }>
  ): Promise<typeof JOB_STATUS.NEEDS_RETRY | undefined> {
    await runSyncJob({
      attempt,
      log,
      maxRetryTime: MAX_RETRY_TIME,
      syncs: data.readSyncs,
      timestamp,
      type: SyncTypeList.Read,
    });

    return undefined;
  }
}

export const readSyncJobQueue = new ReadSyncJobQueue({
  store: jobQueueDatabaseStore,
  queueType: 'read sync',
  maxAttempts: exponentialBackoffMaxAttempts(MAX_RETRY_TIME),
});
