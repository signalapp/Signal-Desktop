// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable class-methods-use-this */

import * as z from 'zod';
import * as moment from 'moment';
import { exponentialBackoffMaxAttempts } from '../util/exponentialBackoff';
import { runReadOrViewSyncJob } from './helpers/runReadOrViewSyncJob';

import { JobQueue } from './JobQueue';
import { jobQueueDatabaseStore } from './JobQueueDatabaseStore';

const MAX_RETRY_TIME = moment.duration(1, 'day').asMilliseconds();

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
    { attempt }: Readonly<{ attempt: number }>
  ): Promise<void> {
    await runReadOrViewSyncJob({
      attempt,
      isView: true,
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
