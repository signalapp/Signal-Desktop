// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import PQueue from 'p-queue';
import lodash from 'lodash';

import {
  conversationJobQueue,
  conversationQueueJobEnum,
} from '../jobs/conversationJobQueue.js';
import { ReceiptType } from '../types/Receipt.js';
import type { Receipt } from '../types/Receipt.js';
import { MINUTE } from './durations/index.js';
import { createBatcher } from './batcher.js';

const { groupBy } = lodash;

export const deliveryReceiptQueue = new PQueue({
  concurrency: 1,
  timeout: MINUTE * 30,
});

deliveryReceiptQueue.pause();

export const deliveryReceiptBatcher = createBatcher<Receipt>({
  name: 'deliveryReceiptBatcher',
  wait: 500,
  maxSize: 100,
  processBatch: async deliveryReceipts => {
    const groups = groupBy(deliveryReceipts, 'conversationId');
    await Promise.all(
      Object.keys(groups).map(async conversationId => {
        await conversationJobQueue.add({
          type: conversationQueueJobEnum.enum.Receipts,
          conversationId,
          receiptsType: ReceiptType.Delivery,
          receipts: groups[conversationId],
        });
      })
    );
  },
});
