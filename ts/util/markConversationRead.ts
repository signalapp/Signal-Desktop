// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNumber, pick } from 'lodash';

import type { ConversationAttributesType } from '../model-types.d';
import { DataWriter } from '../sql/Client';
import { hasErrors } from '../state/selectors/message';
import { readSyncJobQueue } from '../jobs/readSyncJobQueue';
import { notificationService } from '../services/notifications';
import { update as updateExpiringMessagesService } from '../services/expiringMessagesDeletion';
import { tapToViewMessagesDeletionService } from '../services/tapToViewMessagesDeletionService';
import { isGroup, isDirectConversation } from './whatTypeOfConversation';
import { createLogger } from '../logging/log';
import { getConversationIdForLogging } from './idForLogging';
import { drop } from './drop';
import { isNotNil } from './isNotNil';
import { assertDev } from './assert';
import { isConversationAccepted } from './isConversationAccepted';
import { ReadStatus } from '../messages/MessageReadStatus';
import {
  conversationJobQueue,
  conversationQueueJobEnum,
} from '../jobs/conversationJobQueue';
import { ReceiptType } from '../types/Receipt';
import type { AciString } from '../types/ServiceId';
import { isAciString } from './isAciString';
import type { MessageModel } from '../models/messages';
import { postSaveUpdates } from './cleanup';

const log = createLogger('markConversationRead');

export async function markConversationRead(
  conversationAttrs: ConversationAttributesType,
  readMessage: { received_at: number; sent_at: number },
  options: {
    readAt?: number;
    sendReadReceipts: boolean;
  } = {
    sendReadReceipts: true,
  }
): Promise<boolean> {
  const { id: conversationId } = conversationAttrs;

  const [unreadMessages, unreadEditedMessages, unreadReactions] =
    await Promise.all([
      DataWriter.getUnreadByConversationAndMarkRead({
        conversationId,
        readMessageReceivedAt: readMessage.received_at,
        readAt: options.readAt,
        includeStoryReplies: !isGroup(conversationAttrs),
      }),
      DataWriter.getUnreadEditedMessagesAndMarkRead({
        conversationId,
        readMessageReceivedAt: readMessage.received_at,
      }),
      DataWriter.getUnreadReactionsAndMarkRead({
        conversationId,
        readMessageReceivedAt: readMessage.received_at,
      }),
    ]);

  const convoId = getConversationIdForLogging(conversationAttrs);
  const logId = `(${convoId})`;

  log.info(logId, {
    markingReadBefore: {
      sentAt: readMessage.sent_at,
      receivedAt: readMessage.received_at,
    },
    unreadMessages: unreadMessages.length,
    unreadReactions: unreadReactions.length,
  });

  if (
    !unreadMessages.length &&
    !unreadEditedMessages.length &&
    !unreadReactions.length
  ) {
    return false;
  }

  notificationService.removeBy({ conversationId });

  const unreadReactionSyncData = new Map<
    string,
    {
      messageId?: string;
      senderAci?: AciString;
      senderE164?: string;
      timestamp: number;
    }
  >();
  unreadReactions.forEach(reaction => {
    const targetKey = `${reaction.targetAuthorAci}/${reaction.targetTimestamp}`;
    if (unreadReactionSyncData.has(targetKey)) {
      return;
    }
    unreadReactionSyncData.set(targetKey, {
      messageId: reaction.messageId,
      senderE164: undefined,
      senderAci: reaction.targetAuthorAci,
      timestamp: reaction.targetTimestamp,
    });
  });

  const allUnreadMessages = [...unreadMessages, ...unreadEditedMessages];

  const updatedMessages: Array<MessageModel> = [];
  const allReadMessagesSync = allUnreadMessages
    .map(messageSyncData => {
      const message = window.MessageCache.getById(messageSyncData.id);
      // we update the in-memory MessageModel with fresh read/seen status
      if (message) {
        message.set(
          pick(
            messageSyncData,
            'readStatus',
            'seenStatus',
            'expirationStartTimestamp'
          )
        );
        updatedMessages.push(message);
      }

      const {
        sent_at: timestamp,
        source: senderE164,
        sourceServiceId: senderAci,
      } = messageSyncData;

      if (!isNumber(timestamp)) {
        assertDev(
          false,
          `${logId}: message sent_at timestamp is not number` +
            `type=${messageSyncData.type}`
        );
        return undefined;
      }

      if (!isAciString(senderAci)) {
        log.warn(
          `${logId}: message sourceServiceId timestamp is not aci` +
            `type=${messageSyncData.type}`
        );
        return undefined;
      }

      return {
        messageId: messageSyncData.id,
        conversationId: conversationAttrs.id,
        originalReadStatus: messageSyncData.originalReadStatus,
        senderE164,
        senderAci,
        senderId: window.ConversationController.lookupOrCreate({
          e164: senderE164,
          serviceId: senderAci,
          reason: 'markConversationRead',
        })?.id,
        timestamp,
        isDirectConversation: isDirectConversation(conversationAttrs),
        hasErrors: message ? hasErrors(message.attributes) : false,
      };
    })
    .filter(isNotNil);

  // We need to save any messages that are in memory, since their read status could have
  // been overwritten in the DB by a message save from a stale (unread) in-memory model
  if (updatedMessages.length) {
    await DataWriter.saveMessages(
      updatedMessages.map(msg => msg.attributes),
      {
        ourAci: window.textsecure.storage.user.getCheckedAci(),
        postSaveUpdates,
      }
    );
  }

  // Some messages we're marking read are local notifications with no sender or were just
  //   unseen and not unread.
  // Also, if a message has errors, we don't want to send anything out about it:
  //   read syncs - let's wait for a client that really understands the message
  //      to mark it read. we'll mark our local error read locally, though.
  //   read receipts - here we can run into infinite loops, where each time the
  //      conversation is viewed, another error message shows up for the contact
  const unreadMessagesSyncData = allReadMessagesSync.filter(
    item =>
      Boolean(item.senderId) &&
      item.originalReadStatus === ReadStatus.Unread &&
      !item.hasErrors
  );

  const readSyncs: Array<{
    messageId?: string;
    senderE164?: string;
    senderAci?: AciString;
    senderId?: string;
    timestamp: number;
    hasErrors?: string;
  }> = [...unreadMessagesSyncData, ...unreadReactionSyncData.values()];

  if (readSyncs.length && options.sendReadReceipts) {
    log.info(logId, `Sending ${readSyncs.length} read syncs`);
    // Because syncReadMessages sends to our other devices, and sendReadReceipts goes
    //   to a contact, we need accessKeys for both.
    if (window.ConversationController.areWePrimaryDevice()) {
      log.warn(logId, 'We are primary device; not sending read syncs');
    } else {
      drop(readSyncJobQueue.add({ readSyncs }));
    }

    if (isConversationAccepted(conversationAttrs)) {
      await conversationJobQueue.add({
        type: conversationQueueJobEnum.enum.Receipts,
        conversationId,
        receiptsType: ReceiptType.Read,
        receipts: allReadMessagesSync,
      });
    }
  }

  void updateExpiringMessagesService();
  void tapToViewMessagesDeletionService.update();

  return true;
}
