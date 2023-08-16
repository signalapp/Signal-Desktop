// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';

import { aciSchema } from './ServiceId';

export const receiptSchema = z.object({
  messageId: z.string(),
  conversationId: z.string(),
  senderE164: z.string().optional(),
  senderAci: aciSchema.optional(),
  timestamp: z.number(),
  isDirectConversation: z.boolean().optional(),
});

export enum ReceiptType {
  Delivery = 'deliveryReceipt',
  Read = 'readReceipt',
  Viewed = 'viewedReceipt',
}

export type Receipt = z.infer<typeof receiptSchema>;
