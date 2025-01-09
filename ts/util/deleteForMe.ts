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
import { isPniString } from '../types/ServiceId';
import { DataReader, DataWriter, deleteAndCleanup } from '../sql/Client';
import { deleteData } from '../types/Attachment';

import type {
  ConversationAttributesType,
  MessageAttributesType,
} from '../model-types';
import type { ConversationModel } from '../models/conversations';
import type {
  ConversationToDelete,
  MessageToDelete,
} from '../textsecure/messageReceiverEvents';
import type { AciString, PniString } from '../types/ServiceId';
import type { AttachmentType } from '../types/Attachment';
import { MessageModel } from '../models/messages';
import { cleanupMessages, postSaveUpdates } from './cleanup';

const { getMessagesBySentAt, getMostRecentAddressableMessages } = DataReader;

const { removeMessagesInConversation, saveMessage } = DataWriter;

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
    log.warn(`${logId}/deleteMessage: Couldn't find matching message`);
    return false;
  }

  const message = window.MessageCache.register(new MessageModel(found));
  await applyDeleteMessage(message.attributes, logId);

  return true;
}
export async function applyDeleteMessage(
  message: MessageAttributesType,
  logId: string
): Promise<void> {
  await deleteAndCleanup([message], logId, {
    fromSync: true,
    cleanupMessages,
  });
}

export async function deleteAttachmentFromMessage(
  conversationId: string,
  targetMessage: MessageToDelete,
  deleteAttachmentData: {
    clientUuid?: string;
    fallbackDigest?: string;
    fallbackPlaintextHash?: string;
  },
  {
    deleteOnDisk,
    deleteDownloadOnDisk,
    logId,
  }: {
    deleteOnDisk: (path: string) => Promise<void>;
    deleteDownloadOnDisk: (path: string) => Promise<void>;
    logId: string;
  }
): Promise<boolean> {
  const query = getMessageQueryFromTarget(targetMessage);
  const found = await findMatchingMessage(conversationId, query);

  if (!found) {
    log.warn(
      `${logId}/deleteAttachmentFromMessage: Couldn't find matching message`
    );
    return false;
  }

  const message = window.MessageCache.register(new MessageModel(found));

  return applyDeleteAttachmentFromMessage(message, deleteAttachmentData, {
    deleteOnDisk,
    deleteDownloadOnDisk,
    logId,
    shouldSave: true,
  });
}

export async function applyDeleteAttachmentFromMessage(
  message: MessageModel,
  {
    clientUuid,
    fallbackDigest,
    fallbackPlaintextHash,
  }: {
    clientUuid?: string;
    fallbackDigest?: string;
    fallbackPlaintextHash?: string;
  },
  {
    deleteOnDisk,
    deleteDownloadOnDisk,
    shouldSave,
    logId,
  }: {
    deleteOnDisk: (path: string) => Promise<void>;
    deleteDownloadOnDisk: (path: string) => Promise<void>;
    shouldSave: boolean;
    logId: string;
  }
): Promise<boolean> {
  if (!clientUuid && !fallbackDigest && !fallbackPlaintextHash) {
    log.warn(
      `${logId}/deleteAttachmentFromMessage: No clientUuid, fallbackDigest or fallbackPlaintextHash`
    );
    return true;
  }

  const ourAci = window.textsecure.storage.user.getCheckedAci();

  const attachments = message.get('attachments');
  if (!attachments || attachments.length === 0) {
    log.warn(
      `${logId}/deleteAttachmentFromMessage: No attachments on target message`
    );
    return true;
  }

  async function checkFieldAndDelete(
    value: string | undefined,
    valueName: string,
    fieldName: keyof AttachmentType
  ): Promise<boolean> {
    if (value) {
      const attachment = attachments?.find(
        item => item.digest && item[fieldName] === value
      );
      if (attachment) {
        message.set({
          attachments: attachments?.filter(item => item !== attachment),
        });
        if (shouldSave) {
          await saveMessage(message.attributes, { ourAci, postSaveUpdates });
        }
        await deleteData({ deleteOnDisk, deleteDownloadOnDisk })(attachment);

        return true;
      }
      log.warn(
        `${logId}/deleteAttachmentFromMessage: No attachment found with provided ${valueName}`
      );
    } else {
      log.warn(
        `${logId}/deleteAttachmentFromMessage: No ${valueName} provided`
      );
    }

    return false;
  }
  let result: boolean;

  result = await checkFieldAndDelete(clientUuid, 'clientUuid', 'clientUuid');
  if (result) {
    return true;
  }

  result = await checkFieldAndDelete(
    fallbackDigest,
    'fallbackDigest',
    'digest'
  );
  if (result) {
    return true;
  }

  result = await checkFieldAndDelete(
    fallbackPlaintextHash,
    'fallbackPlaintextHash',
    'plaintextHash'
  );
  if (result) {
    return true;
  }

  log.warn(
    `${logId}/deleteAttachmentFromMessage: Couldn't find target attachment`
  );

  return true;
}

async function getMostRecentMatchingMessage(
  conversationId: string,
  targetMessages: Array<MessageToDelete>
): Promise<MessageAttributesType | undefined> {
  const queries = targetMessages.map(getMessageQueryFromTarget);
  const found = await Promise.all(
    queries.map(query => findMatchingMessage(conversationId, query))
  );

  const sorted = sortBy(found, 'received_at');
  return last(sorted);
}

export async function deleteConversation(
  conversation: ConversationModel,
  mostRecentMessages: Array<MessageToDelete>,
  mostRecentNonExpiringMessages: Array<MessageToDelete> | undefined,
  isFullDelete: boolean,
  providedLogId: string
): Promise<boolean> {
  const logId = `${providedLogId}/deleteConversation`;

  const newestMessage = await getMostRecentMatchingMessage(
    conversation.id,
    mostRecentMessages
  );
  if (!newestMessage) {
    log.warn(`${logId}: Found no messages from mostRecentMessages set`);
  } else {
    log.info(`${logId}: Found most recent message from mostRecentMessages set`);
    const { received_at: receivedAt } = newestMessage;

    await removeMessagesInConversation(conversation.id, {
      cleanupMessages,
      fromSync: true,
      logId: `${logId}(receivedAt=${receivedAt})`,
      receivedAt,
    });
  }

  if (!newestMessage && mostRecentNonExpiringMessages?.length) {
    const newestNondisappearingMessage = await getMostRecentMatchingMessage(
      conversation.id,
      mostRecentNonExpiringMessages
    );

    if (!newestNondisappearingMessage) {
      log.warn(
        `${logId}: Found no messages from mostRecentNonExpiringMessages set`
      );
    } else {
      log.info(
        `${logId}: Found most recent message from mostRecentNonExpiringMessages set`
      );
      const { received_at: receivedAt } = newestNondisappearingMessage;

      await removeMessagesInConversation(conversation.id, {
        cleanupMessages,
        fromSync: true,
        logId: `${logId}(receivedAt=${receivedAt})`,
        receivedAt,
      });
    }
  }

  if (isFullDelete) {
    log.info(`${logId}: isFullDelete=true, proceeding to local-only delete`);
    return deleteLocalOnlyConversation(conversation, providedLogId);
  }

  return true;
}

export async function deleteLocalOnlyConversation(
  conversation: ConversationModel,
  providedLogId: string
): Promise<boolean> {
  const logId = `${providedLogId}/deleteLocalOnlyConversation`;
  const limit = 1;
  const messages = await getMostRecentAddressableMessages(
    conversation.id,
    limit
  );
  if (messages.length > 0) {
    log.warn(`${logId}: Cannot delete; found an addressable message`);
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
