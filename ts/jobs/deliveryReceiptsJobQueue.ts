// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';
import type { LoggerType } from '../types/Logging';
import { exponentialBackoffMaxAttempts } from '../util/exponentialBackoff';
import { receiptSchema, ReceiptType } from '../types/Receipt';
import { MAX_RETRY_TIME, runReceiptJob } from './helpers/receiptHelpers';

import { JobQueue } from './JobQueue';
import { jobQueueDatabaseStore } from './JobQueueDatabaseStore';

const deliveryReceiptsJobDataSchema = z.object({
  deliveryReceipts: receiptSchema.array(),
});

type DeliveryReceiptsJobData = z.infer<typeof deliveryReceiptsJobDataSchema>;

export class DeliveryReceiptsJobQueue extends JobQueue<DeliveryReceiptsJobData> {
  protected parseData(data: unknown): DeliveryReceiptsJobData {
    return deliveryReceiptsJobDataSchema.parse(data);
  }

  protected async run(
    {
      data,
      timestamp,
    }: Readonly<{ data: DeliveryReceiptsJobData; timestamp: number }>,
    { attempt, log }: Readonly<{ attempt: number; log: LoggerType }>
  ): Promise<void> {
    await runReceiptJob({
      attempt,
      log,
      timestamp,
      receipts: data.deliveryReceipts,
      type: ReceiptType.Delivery,
    });
  }
}

export const deliveryReceiptsJobQueue = new DeliveryReceiptsJobQueue({
  store: jobQueueDatabaseStore,
  queueType: 'delivery receipts',
  maxAttempts: exponentialBackoffMaxAttempts(MAX_RETRY_TIME),
});
