// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  ConversationIdentifier,
  AddressableMessage,
} from '../textsecure/messageReceiverEvents.std.js';
import type {
  ConversationAttributesType,
  ReadonlyMessageAttributesType,
  MessageAttributesType,
} from '../model-types.d.ts';
import type { AciString, PniString } from '../types/ServiceId.std.js';
import { isPniString } from '../types/ServiceId.std.js';
import { getAuthor } from '../messages/sources.preload.js';
import { createLogger } from '../logging/log.std.js';
import type { ConversationModel } from '../models/conversations.preload.js';
import { DataReader } from '../sql/Client.preload.js';
import {
  getConversationIdForLogging,
  getMessageIdForLogging,
} from './idForLogging.preload.js';
import { isGroup, isGroupV2 } from './whatTypeOfConversation.dom.js';
import { getMessageSentTimestampSet } from './getMessageSentTimestampSet.std.js';
import { isAciString } from './isAciString.std.js';
import { missingCaseError } from './missingCaseError.std.js';

const log = createLogger('syncIdentifiers');

const { getMessagesBySentAt } = DataReader;

export function doesMessageMatch({
  conversationId,
  message,
  query,
  sentTimestamps,
}: {
  message: ReadonlyMessageAttributesType;
  conversationId: string;
  query: MessageQuery;
  sentTimestamps: ReadonlySet<number>;
}): boolean {
  const author = getAuthor(message);

  const conversationMatches = message.conversationId === conversationId;
  const aciMatches =
    query.authorAci && author?.attributes.serviceId === query.authorAci;
  const pniMatches =
    query.authorPni && author?.attributes.serviceId === query.authorPni;
  const e164Matches =
    query.authorE164 && author?.attributes.e164 === query.authorE164;
  const timestampMatches = sentTimestamps.has(query.sentAt);

  return Boolean(
    conversationMatches &&
      timestampMatches &&
      (aciMatches || e164Matches || pniMatches)
  );
}

export async function findMatchingMessage(
  conversationId: string,
  query: MessageQuery
): Promise<MessageAttributesType | undefined> {
  const sentAtMatches = await getMessagesBySentAt(query.sentAt);

  if (!sentAtMatches.length) {
    return undefined;
  }

  return sentAtMatches.find(message => {
    const sentTimestamps = getMessageSentTimestampSet(message);
    return doesMessageMatch({
      conversationId,
      message,
      query,
      sentTimestamps,
    });
  });
}

export function getConversationFromTarget(
  targetConversation: ConversationIdentifier
): ConversationModel | undefined {
  const { type } = targetConversation;

  if (type === 'aci') {
    return window.ConversationController.get(targetConversation.aci);
  }
  if (type === 'group') {
    return window.ConversationController.get(targetConversation.groupId);
  }
  if (type === 'e164') {
    return window.ConversationController.get(targetConversation.e164);
  }
  if (type === 'pni') {
    return window.ConversationController.get(targetConversation.pni);
  }

  throw missingCaseError(type);
}

export type MessageQuery = Readonly<{
  sentAt: number;
  authorAci?: AciString;
  authorE164?: string;
  authorPni?: PniString;
}>;

export function getMessageQueryFromTarget(
  targetMessage: AddressableMessage
): MessageQuery {
  const { type, sentAt } = targetMessage;

  if (type === 'aci') {
    if (!isAciString(targetMessage.authorAci)) {
      throw new Error('Provided authorAci was not an ACI!');
    }
    return { sentAt, authorAci: targetMessage.authorAci };
  }
  if (type === 'pni') {
    if (!isPniString(targetMessage.authorPni)) {
      throw new Error('Provided authorPni was not a PNI!');
    }
    return { sentAt, authorPni: targetMessage.authorPni };
  }

  if (type === 'e164') {
    return { sentAt, authorE164: targetMessage.authorE164 };
  }

  throw missingCaseError(type);
}

export function getConversationIdentifier(
  attributes: ConversationAttributesType
): ConversationIdentifier {
  const { groupId, serviceId: aci, e164 } = attributes;
  const idForLogging = getConversationIdForLogging(attributes);
  const logId = `getConversationIdentifier(${idForLogging})`;

  if (isGroupV2(attributes) && groupId) {
    return {
      type: 'group',
      groupId,
    };
  }
  if (isGroup(attributes)) {
    throw new Error(`${logId}: is a group, but not groupV2 or no groupId!`);
  }
  if (aci && isAciString(aci)) {
    return {
      type: 'aci',
      aci,
    };
  }
  if (e164) {
    return {
      type: 'e164',
      e164,
    };
  }

  throw new Error(`${logId}: No valid identifier found!`);
}

export function getAddressableMessage(
  attributes: ReadonlyMessageAttributesType
): AddressableMessage | undefined {
  const logId = `getAddressableMessage(${getMessageIdForLogging(attributes)})`;
  const { sent_at: sentAt } = attributes;

  const author = getAuthor(attributes);
  const authorAci = author?.get('serviceId');
  const authorE164 = author?.get('e164');

  if (authorAci && isAciString(authorAci)) {
    return {
      type: 'aci' as const,
      authorAci,
      sentAt,
    };
  }
  if (authorE164) {
    return {
      type: 'e164' as const,
      authorE164,
      sentAt,
    };
  }

  log.warn(`${logId}: Message was missing source ACI/e164`);

  return undefined;
}
