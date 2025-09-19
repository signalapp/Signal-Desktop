// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationModel } from '../../models/conversations.js';
import { sendReceipts as sendReceiptsTask } from '../../util/sendReceipts.js';
import type {
  ConversationQueueJobBundle,
  ReceiptsJobData,
} from '../conversationJobQueue.js';
import { shouldSendToConversation } from './shouldSendToConversation.js';

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
