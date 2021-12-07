// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';

export const receiptSchema = z.object({
  messageId: z.string(),
  senderE164: z.string().optional(),
  senderUuid: z.string().optional(),
  timestamp: z.number(),
});

export enum ReceiptType {
  Delivery = 'deliveryReceipt',
  Read = 'readReceipt',
  Viewed = 'viewedReceipt',
}

export type Receipt = z.infer<typeof receiptSchema>;
