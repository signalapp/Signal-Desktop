// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationModel } from '../../models/conversations.preload.ts';
import { sendReceipts as sendReceiptsTask } from '../../util/sendReceipts.preload.ts';
import type {
  ConversationQueueJobBundle,
  ReceiptsJobData,
} from '../conversationJobQueue.preload.ts';
import { shouldSendToConversation } from './shouldSendToConversation.preload.ts';

export async function sendReceipts(
  conversation: ConversationModel,
  { log }: ConversationQueueJobBundle,
  data: ReceiptsJobData
): Promise<void> {
  if (!shouldSendToConversation(conversation, log)) {
    return;
  }
  await sendReceiptsTask({
    log,
    receipts: data.receipts,
    type: data.receiptsType,
  });
}
