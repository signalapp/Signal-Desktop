// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as durations from '../util/durations/index.std.js';
import type { LoggerType } from '../types/Logging.std.js';
import { exponentialBackoffMaxAttempts } from '../util/exponentialBackoff.std.js';
import type { SyncType } from './helpers/syncHelpers.preload.js';
import {
  SyncTypeList,
  parseRawSyncDataArray,
  runSyncJob,
} from './helpers/syncHelpers.preload.js';
import { strictAssert } from '../util/assert.std.js';
import { isRecord } from '../util/isRecord.std.js';

import type { JOB_STATUS } from './JobQueue.std.js';
import { JobQueue } from './JobQueue.std.js';
import { jobQueueDatabaseStore } from './JobQueueDatabaseStore.preload.js';

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
