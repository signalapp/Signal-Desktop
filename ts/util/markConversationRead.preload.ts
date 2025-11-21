// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';

import type { ConversationAttributesType } from '../model-types.d.ts';
import { DataWriter } from '../sql/Client.preload.js';
import { hasErrors } from '../state/selectors/message.preload.js';
import { readSyncJobQueue } from '../jobs/readSyncJobQueue.preload.js';
import { notificationService } from '../services/notifications.preload.js';
import { update as updateExpiringMessagesService } from '../services/expiringMessagesDeletion.preload.js';
import { tapToViewMessagesDeletionService } from '../services/tapToViewMessagesDeletionService.preload.js';
import { isGroup, isDirectConversation } from './whatTypeOfConversation.dom.js';
import { createLogger } from '../logging/log.std.js';
import { getConversationIdForLogging } from './idForLogging.preload.js';
import { drop } from './drop.std.js';
import { isNotNil } from './isNotNil.std.js';
import { assertDev } from './assert.std.js';
import { isConversationAccepted } from './isConversationAccepted.preload.js';
import { ReadStatus } from '../messages/MessageReadStatus.std.js';
import {
  conversationJobQueue,
  conversationQueueJobEnum,
} from '../jobs/conversationJobQueue.preload.js';
import { ReceiptType } from '../types/Receipt.std.js';
import type { AciString } from '../types/ServiceId.std.js';
import { isAciString } from './isAciString.std.js';
import type { MessageModel } from '../models/messages.preload.js';
import { postSaveUpdates } from './cleanup.preload.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

const { isNumber, pick } = lodash;

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

  const [
    unreadMessages,
    unreadEditedMessages,
    unreadReactions,
    unreadPollVotes,
  ] = await Promise.all([
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
    DataWriter.getUnreadPollVotesAndMarkRead({
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
    unreadPollVotes: unreadPollVotes.length,
  });

  if (
    !unreadMessages.length &&
    !unreadEditedMessages.length &&
    !unreadReactions.length &&
    !unreadPollVotes.length
  ) {
    return false;
  }

  notificationService.removeBy({ conversationId });

  const unreadReadSyncData = new Map<
    string,
    {
      messageId?: string;
      timestamp: number;
    } & (
      | { senderAci: AciString; senderE164?: string }
      | { senderE164: string; senderAci?: AciString }
    )
  >();
  unreadReactions.forEach(reaction => {
    const targetKey = `${reaction.targetAuthorAci}/${reaction.targetTimestamp}`;
    if (unreadReadSyncData.has(targetKey)) {
      return;
    }
    unreadReadSyncData.set(targetKey, {
      messageId: reaction.messageId,
      senderE164: undefined,
      senderAci: reaction.targetAuthorAci,
      timestamp: reaction.targetTimestamp,
    });
  });

  unreadPollVotes.forEach(pollVote => {
    if (pollVote.type !== 'outgoing') {
      log.warn(
        'Found a message with unread poll votes that is not outgoing, not sending read sync'
      );
      return;
    }
    const targetAuthorAci = itemStorage.user.getCheckedAci();
    const targetKey = `${targetAuthorAci}/${pollVote.targetTimestamp}`;
    if (unreadReadSyncData.has(targetKey)) {
      return;
    }
    unreadReadSyncData.set(targetKey, {
      messageId: pollVote.id,
      senderE164: undefined,
      senderAci: targetAuthorAci,
      timestamp: pollVote.targetTimestamp,
    });
  });

  const allUnreadMessages = [...unreadMessages, ...unreadEditedMessages];

  const updatedMessages: Array<MessageModel> = [];

  // Update in-memory MessageModels for poll votes
  unreadPollVotes.forEach(pollVote => {
    const message = window.MessageCache.getById(pollVote.id);
    if (message) {
      message.set({ hasUnreadPollVotes: false });
      updatedMessages.push(message);
    }
  });
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

      // This is expected for directionless messages which are inserted as Read but Unseen
      // (e.g. keyChange)
      if (!isAciString(senderAci)) {
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
        ourAci: itemStorage.user.getCheckedAci(),
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
  }> = [...unreadMessagesSyncData, ...unreadReadSyncData.values()];

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
