// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as durations from '../util/durations/index.std.ts';
import type { LoggerType } from '../types/Logging.std.ts';
import { exponentialBackoffMaxAttempts } from '../util/exponentialBackoff.std.ts';
import type { SyncType } from './helpers/syncHelpers.preload.ts';
import {
  SyncTypeList,
  parseRawSyncDataArray,
  runSyncJob,
} from './helpers/syncHelpers.preload.ts';
import { strictAssert } from '../util/assert.std.ts';
import { isRecord } from '../util/isRecord.std.ts';

import type { JOB_STATUS } from './JobQueue.std.ts';
import { JobQueue } from './JobQueue.std.ts';
import { jobQueueDatabaseStore } from './JobQueueDatabaseStore.preload.ts';

const MAX_RETRY_TIME = durations.DAY;

export type ReadSyncJobData = {
  readSyncs: Array<SyncType>;
};

class ReadSyncJobQueue extends JobQueue<ReadSyncJobData> {
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
