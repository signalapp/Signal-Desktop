// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationModel } from '../../models/conversations';
import { sendReceipts as sendReceiptsTask } from '../../util/sendReceipts';
import type {
  ConversationQueueJobBundle,
  ReceiptsJobData,
} from '../conversationJobQueue';

export async function sendReceipts(
  _conversation: ConversationModel,
  { log }: ConversationQueueJobBundle,
  data: ReceiptsJobData
): Promise<void> {
  await sendReceiptsTask({
    log,
    receipts: data.receipts,
    type: data.receiptsType,
  });
}
