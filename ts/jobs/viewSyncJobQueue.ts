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

const viewSyncJobDataSchema = z.object({
  viewSyncs: z.array(
    z.object({
      messageId: z.string().optional(),
      senderE164: z.string().optional(),
      senderUuid: z.string().optional(),
      timestamp: z.number(),
    })
  ),
});

export type ViewSyncJobData = z.infer<typeof viewSyncJobDataSchema>;

export class ViewSyncJobQueue extends JobQueue<ViewSyncJobData> {
  protected parseData(data: unknown): ViewSyncJobData {
    return viewSyncJobDataSchema.parse(data);
  }

  protected async run(
    { data, timestamp }: Readonly<{ data: ViewSyncJobData; timestamp: number }>,
    { attempt, log }: Readonly<{ attempt: number; log: LoggerType }>
  ): Promise<void> {
    await runReadOrViewSyncJob({
      attempt,
      isView: true,
      log,
      maxRetryTime: MAX_RETRY_TIME,
      syncs: data.viewSyncs,
      timestamp,
    });
  }
}

export const viewSyncJobQueue = new ViewSyncJobQueue({
  store: jobQueueDatabaseStore,
  queueType: 'view sync',
  maxAttempts: exponentialBackoffMaxAttempts(MAX_RETRY_TIME),
});
