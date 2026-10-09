// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ReadStatus } from '../messages/MessageReadStatus.std.ts';
import type { MessageAttributesType } from '../model-types.d.ts';
import { BodyRange } from '../types/BodyRange.std.ts';
import type {
  AttachmentMetadataDTO,
  MentionDTO,
  MessageDTO,
  MessageKindType,
  MessageSendStatusType,
  QuoteDTO,
  ReactionDTO,
} from './protocol.std.ts';
import { MessageKind } from './protocol.std.ts';

// Maps Signal's message attributes to the public DTO. Like the conversation
// mapper, fields are copied one by one so that new internal fields never
// reach clients by accident.

export type MessageSourceType = Pick<
  MessageAttributesType,
  | 'id'
  | 'conversationId'
  | 'type'
  | 'sent_at'
  | 'received_at_ms'
  | 'body'
  | 'bodyAttachment'
  | 'bodyRanges'
  | 'attachments'
  | 'sticker'
  | 'quote'
  | 'isViewOnce'
  | 'isErased'
  | 'deletedForEveryone'
  | 'editHistory'
  | 'expireTimer'
  | 'expirationStartTimestamp'
  | 'readStatus'
  | 'reactions'
  | 'sourceServiceId'
  // Read only by `getSendStatus`.
  | 'deletedForEveryoneFailed'
  | 'deletedForEveryoneSendStatus'
  | 'errors'
  | 'sendStateByConversationId'
>;

export type MessageDtoContextType = Readonly<{
  // Maps a service id to our conversation id for that person, or null.
  // Must not create conversations.
  resolveConversationId: (serviceId: string) => string | null;
  ourConversationId: string | null;
  now: number;
  // Signal's own status for an outgoing message, as the timeline shows it.
  getSendStatus: (message: MessageSourceType) => MessageSendStatusType | null;
}>;

function getMessageExpiresAt(
  message: Pick<MessageSourceType, 'expireTimer' | 'expirationStartTimestamp'>
): number | null {
  const { expireTimer, expirationStartTimestamp } = message;
  if (!expireTimer || !expirationStartTimestamp) {
    return null;
  }
  return expirationStartTimestamp + expireTimer * 1000;
}

function getKind(message: MessageSourceType): MessageKindType {
  if (message.deletedForEveryone) {
    return MessageKind.Deleted;
  }
  if (message.isViewOnce) {
    return MessageKind.ViewOnce;
  }
  if (message.sticker) {
    return MessageKind.Sticker;
  }
  if (message.body || message.attachments?.length) {
    return MessageKind.Text;
  }
  return MessageKind.Unsupported;
}

function toMentions(
  message: MessageSourceType,
  context: MessageDtoContextType
): Array<MentionDTO> {
  return (message.bodyRanges ?? []).filter(BodyRange.isMention).map(range => ({
    start: range.start,
    length: range.length,
    conversationId: context.resolveConversationId(range.mentionAci),
  }));
}

// `fromId` is already a conversation id. Reactions being removed have no
// emoji and are left out.
function toReactions(message: MessageSourceType): Array<ReactionDTO> {
  return (message.reactions ?? [])
    .filter(reaction => reaction.emoji)
    .toSorted((a, b) => a.timestamp - b.timestamp)
    .map(reaction => ({
      emoji: reaction.emoji ?? '',
      authorConversationId: reaction.fromId,
    }));
}

function toAttachments(
  message: MessageSourceType
): Array<AttachmentMetadataDTO> {
  return (message.attachments ?? []).map(attachment => ({
    contentType: attachment.contentType,
    size: attachment.size,
    fileName: attachment.fileName ?? null,
    width: attachment.width ?? null,
    height: attachment.height ?? null,
  }));
}

function toQuote(
  message: MessageSourceType,
  context: MessageDtoContextType
): QuoteDTO | null {
  const { quote } = message;
  if (!quote) {
    return null;
  }
  return {
    authorConversationId: quote.authorAci
      ? context.resolveConversationId(quote.authorAci)
      : null,
    sentAt: quote.id,
    // A quote of a view-once message must not reveal it.
    text: quote.isViewOnce ? null : (quote.text ?? null),
  };
}

// Returns undefined for messages that are not shown as chat messages
// (notifications, group updates, call history...) and for disappearing
// messages that have already expired.
export function toMessageDTO(
  message: MessageSourceType,
  context: MessageDtoContextType
): MessageDTO | undefined {
  const { type } = message;
  if (type !== 'incoming' && type !== 'outgoing') {
    return undefined;
  }

  const expiresAt = getMessageExpiresAt(message);
  if (expiresAt != null && expiresAt <= context.now) {
    return undefined;
  }

  const kind = getKind(message);
  // Content of deleted, erased and view-once messages never crosses.
  const hidden =
    kind === MessageKind.Deleted ||
    kind === MessageKind.ViewOnce ||
    Boolean(message.isErased);

  let authorConversationId: string | null;
  if (type === 'outgoing') {
    authorConversationId = context.ourConversationId;
  } else {
    authorConversationId = message.sourceServiceId
      ? context.resolveConversationId(message.sourceServiceId)
      : null;
  }

  return {
    id: message.id,
    conversationId: message.conversationId,
    direction: type,
    kind,
    authorConversationId,
    sentAt: message.sent_at,
    receivedAt: message.received_at_ms ?? null,
    body: hidden ? null : (message.body ?? null),
    bodyTruncated: !hidden && message.bodyAttachment != null,
    mentions: hidden ? [] : toMentions(message, context),
    attachments: hidden ? [] : toAttachments(message),
    quote: hidden ? null : toQuote(message, context),
    edited: (message.editHistory?.length ?? 0) > 1,
    expiresAt,
    read: type === 'incoming' ? message.readStatus !== ReadStatus.Unread : null,
    sendStatus: type === 'outgoing' ? context.getSendStatus(message) : null,
    reactions: hidden ? [] : toReactions(message),
  };
}
