// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable class-methods-use-this */

import { z } from 'zod';
import * as durations from '../util/durations';
import type { LoggerType } from '../types/Logging';
import { exponentialBackoffMaxAttempts } from '../util/exponentialBackoff';
import { commonShouldJobContinue } from './helpers/commonShouldJobContinue';
import { sendViewedReceipt } from '../util/sendViewedReceipt';

import { JobQueue } from './JobQueue';
import { jobQueueDatabaseStore } from './JobQueueDatabaseStore';
import { handleCommonJobRequestError } from './helpers/handleCommonJobRequestError';

const MAX_RETRY_TIME = durations.DAY;

const viewedReceiptsJobDataSchema = z.object({
  viewedReceipt: z.object({
    messageId: z.string(),
    senderE164: z.string().optional(),
    senderUuid: z.string().optional(),
    timestamp: z.number(),
  }),
});

type ViewedReceiptsJobData = z.infer<typeof viewedReceiptsJobDataSchema>;

export class ViewedReceiptsJobQueue extends JobQueue<ViewedReceiptsJobData> {
  protected parseData(data: unknown): ViewedReceiptsJobData {
    return viewedReceiptsJobDataSchema.parse(data);
  }

  protected async run(
    {
      data,
      timestamp,
    }: Readonly<{ data: ViewedReceiptsJobData; timestamp: number }>,
    { attempt, log }: Readonly<{ attempt: number; log: LoggerType }>
  ): Promise<void> {
    const timeRemaining = timestamp + MAX_RETRY_TIME - Date.now();

    const shouldContinue = await commonShouldJobContinue({
      attempt,
      log,
      timeRemaining,
    });
    if (!shouldContinue) {
      return;
    }

    try {
      await sendViewedReceipt(data.viewedReceipt, log);
    } catch (err: unknown) {
      await handleCommonJobRequestError({ err, log, timeRemaining });
    }
  }
}

export const viewedReceiptsJobQueue = new ViewedReceiptsJobQueue({
  store: jobQueueDatabaseStore,
  queueType: 'viewed receipts',
  maxAttempts: exponentialBackoffMaxAttempts(MAX_RETRY_TIME),
});
