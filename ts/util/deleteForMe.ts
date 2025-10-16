// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';

import { createLogger } from '../logging/log.std.js';
import {
  DataReader,
  DataWriter,
  deleteAndCleanup,
} from '../sql/Client.preload.js';
import { deleteAllAttachmentFilesOnDisk } from './Attachment.std.js';

import type { MessageAttributesType } from '../model-types.d.ts';
import type { ConversationModel } from '../models/conversations.preload.js';
import type { AddressableMessage } from '../textsecure/messageReceiverEvents.std.js';
import type { AttachmentType } from '../types/Attachment.std.js';
import { MessageModel } from '../models/messages.preload.js';
import { cleanupMessages, postSaveUpdates } from './cleanup.preload.js';
import {
  findMatchingMessage,
  getMessageQueryFromTarget,
} from './syncIdentifiers.preload.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

const { last, sortBy } = lodash;

const log = createLogger('deleteForMe');

const { getMostRecentAddressableMessages } = DataReader;

const { removeMessagesInConversation, saveMessage } = DataWriter;

export async function deleteMessage(
  conversationId: string,
  targetMessage: AddressableMessage,
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
  targetMessage: AddressableMessage,
  deleteAttachmentData: {
    clientUuid?: string;
    fallbackDigest?: string;
    fallbackPlaintextHash?: string;
  },
  {
    deleteAttachmentOnDisk,
    deleteDownloadOnDisk,
    logId,
  }: {
    deleteAttachmentOnDisk: (path: string) => Promise<void>;
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
    deleteAttachmentOnDisk,
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
    deleteAttachmentOnDisk,
    deleteDownloadOnDisk,
    shouldSave,
    logId,
  }: {
    deleteAttachmentOnDisk: (path: string) => Promise<void>;
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

  const ourAci = itemStorage.user.getCheckedAci();

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
        await deleteAllAttachmentFilesOnDisk({
          deleteAttachmentOnDisk,
          deleteDownloadOnDisk,
        })(attachment);

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
  targetMessages: Array<AddressableMessage>
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
  mostRecentMessages: Array<AddressableMessage>,
  mostRecentNonExpiringMessages: Array<AddressableMessage> | undefined,
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
