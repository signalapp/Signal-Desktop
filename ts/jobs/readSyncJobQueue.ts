// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable class-methods-use-this */

import * as z from 'zod';
import * as durations from '../util/durations';
import type { LoggerType } from '../logging/log';
import { exponentialBackoffMaxAttempts } from '../util/exponentialBackoff';
import { runReadOrViewSyncJob } from './helpers/runReadOrViewSyncJob';

import { JobQueue } from './JobQueue';
import { jobQueueDatabaseStore } from './JobQueueDatabaseStore';

const MAX_RETRY_TIME = durations.DAY;

const readSyncJobDataSchema = z.object({
  readSyncs: z.array(
    z.object({
      messageId: z.string().optional(),
      senderE164: z.string().optional(),
      senderUuid: z.string().optional(),
      timestamp: z.number(),
    })
  ),
});

export type ReadSyncJobData = z.infer<typeof readSyncJobDataSchema>;

export class ReadSyncJobQueue extends JobQueue<ReadSyncJobData> {
  protected parseData(data: unknown): ReadSyncJobData {
    return readSyncJobDataSchema.parse(data);
  }

  protected async run(
    { data, timestamp }: Readonly<{ data: ReadSyncJobData; timestamp: number }>,
    { attempt, log }: Readonly<{ attempt: number; log: LoggerType }>
  ): Promise<void> {
    await runReadOrViewSyncJob({
      attempt,
      isView: false,
      log,
      maxRetryTime: MAX_RETRY_TIME,
      syncs: data.readSyncs,
      timestamp,
    });
  }
}

export const readSyncJobQueue = new ReadSyncJobQueue({
  store: jobQueueDatabaseStore,
  queueType: 'read sync',
  maxAttempts: exponentialBackoffMaxAttempts(MAX_RETRY_TIME),
});
