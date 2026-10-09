// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationModel } from '../../models/conversations.preload.ts';
import type {
  LastMessageStatus,
  MessageAttributesType,
} from '../../model-types.d.ts';
import { DataReader } from '../../sql/Client.preload.ts';
import { getMessagePropStatus } from '../../state/selectors/message.preload.ts';
import { isListedConversation } from '../conversationDto.std.ts';
import type { MessageDtoContextType } from '../messageDto.std.ts';
import type { MessageSendStatusType } from '../protocol.std.ts';
import { MessageSendStatus } from '../protocol.std.ts';

// Lookups shared by the renderer service modules.

// `get` also resolves phone numbers and service ids; only accept our own
// conversation ids so this cannot be used as a lookup oracle. Conversations
// the left pane would not show are treated as missing.
export function getListedConversation(
  conversationId: string
): ConversationModel | undefined {
  const model = window.ConversationController.get(conversationId);
  if (!model || model.id !== conversationId) {
    return undefined;
  }
  return isListedConversation(model.format()) ? model : undefined;
}

const SEND_STATUS: Record<LastMessageStatus, MessageSendStatusType> = {
  sending: MessageSendStatus.Sending,
  paused: MessageSendStatus.Paused,
  error: MessageSendStatus.Failed,
  'partial-sent': MessageSendStatus.PartiallySent,
  sent: MessageSendStatus.Sent,
  delivered: MessageSendStatus.Delivered,
  read: MessageSendStatus.Read,
  viewed: MessageSendStatus.Viewed,
};

export function getDtoContext(): MessageDtoContextType {
  const controller = window.ConversationController;
  const ourConversationId = controller.getOurConversationId();
  return {
    resolveConversationId: serviceId => controller.get(serviceId)?.id ?? null,
    ourConversationId: ourConversationId ?? null,
    now: Date.now(),
    getSendStatus: message => {
      const status = getMessagePropStatus(message, ourConversationId);
      return status ? SEND_STATUS[status] : null;
    },
  };
}

// In-memory state wins over the database, as it does for the timeline.
export function preferCached(
  message: MessageAttributesType
): MessageAttributesType {
  return window.MessageCache.getById(message.id)?.attributes ?? message;
}

export async function loadMessage(
  messageId: string
): Promise<MessageAttributesType | undefined> {
  const cached = window.MessageCache.getById(messageId);
  if (cached) {
    return cached.attributes;
  }
  return DataReader.getMessageById(messageId);
}
