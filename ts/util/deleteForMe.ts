// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { last, sortBy } from 'lodash';

import * as log from '../logging/log';
import { isAciString } from './isAciString';
import { isGroup, isGroupV2 } from './whatTypeOfConversation';
import {
  getConversationIdForLogging,
  getMessageIdForLogging,
} from './idForLogging';
import { missingCaseError } from './missingCaseError';
import { getMessageSentTimestampSet } from './getMessageSentTimestampSet';
import { getAuthor } from '../messages/helpers';
import dataInterface, { deleteAndCleanup } from '../sql/Client';

import type {
  ConversationAttributesType,
  MessageAttributesType,
} from '../model-types';
import type { ConversationModel } from '../models/conversations';
import type {
  ConversationToDelete,
  MessageToDelete,
} from '../textsecure/messageReceiverEvents';
import { isPniString } from '../types/ServiceId';
import type { AciString, PniString } from '../types/ServiceId';
import { singleProtoJobQueue } from '../jobs/singleProtoJobQueue';

const {
  getMessagesBySentAt,
  getMostRecentAddressableMessages,
  removeMessagesInConversation,
} = dataInterface;

export function doesMessageMatch({
  conversationId,
  message,
  query,
  sentTimestamps,
}: {
  message: MessageAttributesType;
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

export async function deleteMessage(
  conversationId: string,
  targetMessage: MessageToDelete,
  logId: string
): Promise<boolean> {
  const query = getMessageQueryFromTarget(targetMessage);
  const found = await findMatchingMessage(conversationId, query);

  if (!found) {
    log.warn(`${logId}: Couldn't find matching message`);
    return false;
  }

  await deleteAndCleanup([found], logId, {
    fromSync: true,
    singleProtoJobQueue,
  });

  return true;
}

export async function deleteConversation(
  conversation: ConversationModel,
  mostRecentMessages: Array<MessageToDelete>,
  isFullDelete: boolean,
  logId: string
): Promise<boolean> {
  const queries = mostRecentMessages.map(getMessageQueryFromTarget);
  const found = await Promise.all(
    queries.map(query => findMatchingMessage(conversation.id, query))
  );

  const sorted = sortBy(found, 'received_at');
  const newestMessage = last(sorted);
  if (newestMessage) {
    const { received_at: receivedAt } = newestMessage;

    await removeMessagesInConversation(conversation.id, {
      fromSync: true,
      receivedAt,
      logId: `${logId}(receivedAt=${receivedAt})`,
      singleProtoJobQueue,
    });
  }

  if (!newestMessage) {
    log.warn(`${logId}: Found no target messages for delete`);
  }

  if (isFullDelete) {
    log.info(`${logId}: isFullDelete=true, proceeding to local-only delete`);
    return deleteLocalOnlyConversation(conversation, logId);
  }

  return true;
}

export async function deleteLocalOnlyConversation(
  conversation: ConversationModel,
  logId: string
): Promise<boolean> {
  const limit = 1;
  const messages = await getMostRecentAddressableMessages(
    conversation.id,
    limit
  );
  if (messages.length > 0) {
    log.warn(
      `${logId}: Attempted local-only delete but found an addressable message`
    );
    return false;
  }

  // This will delete all messages and remove the conversation from the left pane.
  // We need to call destroyMessagesInner, since we're already in conversation.queueJob()
  await conversation.destroyMessagesInner({
    logId,
    source: 'local-delete-sync',
  });

  return true;
}

export function getConversationFromTarget(
  targetConversation: ConversationToDelete
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

type MessageQuery = {
  sentAt: number;
  authorAci?: AciString;
  authorE164?: string;
  authorPni?: PniString;
};

export function getMessageQueryFromTarget(
  targetMessage: MessageToDelete
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

export function getConversationToDelete(
  attributes: ConversationAttributesType
): ConversationToDelete {
  const { groupId, serviceId: aci, e164 } = attributes;
  const idForLogging = getConversationIdForLogging(attributes);
  const logId = `getConversationToDelete(${idForLogging})`;

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

export function getMessageToDelete(
  attributes: MessageAttributesType
): MessageToDelete | undefined {
  const logId = `getMessageToDelete(${getMessageIdForLogging(attributes)})`;
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
