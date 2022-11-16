// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { getMessageById } from '../messages/getMessageById';

export async function retryMessageSend(messageId: string): Promise<void> {
  const message = await getMessageById(messageId);
  if (!message) {
    throw new Error(`retryMessageSend: Message ${messageId} missing!`);
  }
  await message.retrySend();
}
