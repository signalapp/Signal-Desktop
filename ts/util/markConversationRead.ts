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
import * as log from '../logging/log';
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

export async function markConversationRead(
  conversationAttrs: ConversationAttributesType,
  newestUnreadAt: number,
  options: {
    readAt?: number;
    sendReadReceipts: boolean;
    newestSentAt?: number;
  } = {
    sendReadReceipts: true,
  }
): Promise<boolean> {
  const { id: conversationId } = conversationAttrs;

  const [unreadMessages, unreadEditedMessages, unreadReactions] =
    await Promise.all([
      DataWriter.getUnreadByConversationAndMarkRead({
        conversationId,
        newestUnreadAt,
        readAt: options.readAt,
        includeStoryReplies: !isGroup(conversationAttrs),
      }),
      DataWriter.getUnreadEditedMessagesAndMarkRead({
        conversationId,
        newestUnreadAt,
      }),
      DataWriter.getUnreadReactionsAndMarkRead({
        conversationId,
        newestUnreadAt,
      }),
    ]);

  const convoId = getConversationIdForLogging(conversationAttrs);
  const logId = `markConversationRead(${convoId})`;

  log.info(logId, {
    newestSentAt: options.newestSentAt,
    newestUnreadAt,
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
    log.info(`Sending ${readSyncs.length} read syncs`);
    // Because syncReadMessages sends to our other devices, and sendReadReceipts goes
    //   to a contact, we need accessKeys for both.
    if (window.ConversationController.areWePrimaryDevice()) {
      log.warn(
        'markConversationRead: We are primary device; not sending read syncs'
      );
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
