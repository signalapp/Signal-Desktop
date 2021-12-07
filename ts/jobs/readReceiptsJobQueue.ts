// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';
import type { LoggerType } from '../types/Logging';
import { exponentialBackoffMaxAttempts } from '../util/exponentialBackoff';
import type { StorageInterface } from '../types/Storage.d';
import type { Receipt } from '../types/Receipt';
import { receiptSchema, ReceiptType } from '../types/Receipt';
import { MAX_RETRY_TIME, runReceiptJob } from './helpers/receiptHelpers';

import { JobQueue } from './JobQueue';
import { jobQueueDatabaseStore } from './JobQueueDatabaseStore';

const readReceiptsJobDataSchema = z.object({
  readReceipts: receiptSchema.array(),
});

type ReadReceiptsJobData = z.infer<typeof readReceiptsJobDataSchema>;

export class ReadReceiptsJobQueue extends JobQueue<ReadReceiptsJobData> {
  public async addIfAllowedByUser(
    storage: Pick<StorageInterface, 'get'>,
    readReceipts: Array<Receipt>
  ): Promise<void> {
    if (storage.get('read-receipt-setting')) {
      await this.add({ readReceipts });
    }
  }

  protected parseData(data: unknown): ReadReceiptsJobData {
    return readReceiptsJobDataSchema.parse(data);
  }

  protected async run(
    {
      data,
      timestamp,
    }: Readonly<{ data: ReadReceiptsJobData; timestamp: number }>,
    { attempt, log }: Readonly<{ attempt: number; log: LoggerType }>
  ): Promise<void> {
    await runReceiptJob({
      attempt,
      log,
      timestamp,
      receipts: data.readReceipts,
      type: ReceiptType.Read,
    });
  }
}

export const readReceiptsJobQueue = new ReadReceiptsJobQueue({
  store: jobQueueDatabaseStore,
  queueType: 'read receipts',
  maxAttempts: exponentialBackoffMaxAttempts(MAX_RETRY_TIME),
});
