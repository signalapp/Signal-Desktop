// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export async function retryMessageSend(messageId: string): Promise<void> {
  const message = window.MessageController.getById(messageId);
  if (!message) {
    throw new Error(`retryMessageSend: Message ${messageId} missing!`);
  }
  await message.retrySend();
}
