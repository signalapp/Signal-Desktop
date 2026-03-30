// Copyright 2022 Signal Messenger, LLC
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

export type ViewOnceOpenJobData = {
  viewOnceOpens: Array<SyncType>;
};

export class ViewOnceOpenJobQueue extends JobQueue<ViewOnceOpenJobData> {
  protected parseData(data: unknown): ViewOnceOpenJobData {
    strictAssert(isRecord(data), 'data is not an object');
    return { viewOnceOpens: parseRawSyncDataArray(data.viewOnceOpens) };
  }

  protected async run(
    {
      data,
      timestamp,
    }: Readonly<{ data: ViewOnceOpenJobData; timestamp: number }>,
    { attempt, log }: Readonly<{ attempt: number; log: LoggerType }>
  ): Promise<typeof JOB_STATUS.NEEDS_RETRY | undefined> {
    await runSyncJob({
      attempt,
      log,
      maxRetryTime: MAX_RETRY_TIME,
      syncs: data.viewOnceOpens,
      timestamp,
      type: SyncTypeList.ViewOnceOpen,
    });

    return undefined;
  }
}

export const viewOnceOpenJobQueue = new ViewOnceOpenJobQueue({
  store: jobQueueDatabaseStore,
  queueType: 'view once open sync',
  maxAttempts: exponentialBackoffMaxAttempts(MAX_RETRY_TIME),
});
