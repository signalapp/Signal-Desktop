// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../model-types.d';
import { deletePackReference } from '../types/Stickers';

export async function cleanupMessage(
  message: MessageAttributesType
): Promise<void> {
  const { id, conversationId } = message;

  window.reduxActions?.conversations.messageDeleted(id, conversationId);

  const parentConversation = window.ConversationController.get(conversationId);
  parentConversation?.debouncedUpdateLastMessage?.();

  window.MessageController.unregister(id);

  await deleteMessageData(message);
}

export async function deleteMessageData(
  message: MessageAttributesType
): Promise<void> {
  await window.Signal.Migrations.deleteExternalMessageFiles(message);

  const { sticker } = message;
  if (!sticker) {
    return;
  }

  const { packId } = sticker;
  if (packId) {
    await deletePackReference(message.id, packId);
  }
}
