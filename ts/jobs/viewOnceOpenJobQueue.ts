// Copyright 2022 Signal Messenger, LLC
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
