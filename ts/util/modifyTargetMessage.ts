// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isEqual } from 'lodash';
import type { ConversationModel } from '../models/conversations';
import type { MessageModel } from '../models/messages';
import type { SendStateByConversationId } from '../messages/MessageSendState';

import * as Edits from '../messageModifiers/Edits';
import * as log from '../logging/log';
import * as Deletes from '../messageModifiers/Deletes';
import * as MessageReceipts from '../messageModifiers/MessageReceipts';
import * as Reactions from '../messageModifiers/Reactions';
import * as ReadSyncs from '../messageModifiers/ReadSyncs';
import * as ViewOnceOpenSyncs from '../messageModifiers/ViewOnceOpenSyncs';
import * as ViewSyncs from '../messageModifiers/ViewSyncs';
import { ReadStatus } from '../messages/MessageReadStatus';
import { SeenStatus } from '../MessageSeenStatus';
import { SendActionType, sendStateReducer } from '../messages/MessageSendState';
import { canConversationBeUnarchived } from './canConversationBeUnarchived';
import { deleteForEveryone } from './deleteForEveryone';
import { drop } from './drop';
import { handleEditMessage } from './handleEditMessage';
import { isGroup } from './whatTypeOfConversation';
import { isStory, isTapToView } from '../state/selectors/message';
import { getOwn } from './getOwn';
import { getSourceServiceId } from '../messages/helpers';
import { missingCaseError } from './missingCaseError';
import { reduce } from './iterables';
import { strictAssert } from './assert';

// This function is called twice - once from handleDataMessage, and then again from
//    saveAndNotify, a function called at the end of handleDataMessage as a cleanup for
//    any missed out-of-order events.
export async function modifyTargetMessage(
  message: MessageModel,
  conversation: ConversationModel,
  options?: { isFirstRun: boolean; skipEdits: boolean }
): Promise<void> {
  const { isFirstRun = false, skipEdits = false } = options ?? {};

  const logId = `modifyTargetMessage/${message.idForLogging()}`;
  const type = message.get('type');
  let changed = false;
  const ourAci = window.textsecure.storage.user.getCheckedAci();
  const sourceServiceId = getSourceServiceId(message.attributes);

  if (type === 'outgoing' || (type === 'story' && ourAci === sourceServiceId)) {
    const sendActions = MessageReceipts.forMessage(message).map(receipt => {
      let sendActionType: SendActionType;
      const receiptType = receipt.type;
      switch (receiptType) {
        case MessageReceipts.MessageReceiptType.Delivery:
          sendActionType = SendActionType.GotDeliveryReceipt;
          break;
        case MessageReceipts.MessageReceiptType.Read:
          sendActionType = SendActionType.GotReadReceipt;
          break;
        case MessageReceipts.MessageReceiptType.View:
          sendActionType = SendActionType.GotViewedReceipt;
          break;
        default:
          throw missingCaseError(receiptType);
      }

      return {
        destinationConversationId: receipt.sourceConversationId,
        action: {
          type: sendActionType,
          updatedAt: receipt.receiptTimestamp,
        },
      };
    });

    const oldSendStateByConversationId =
      message.get('sendStateByConversationId') || {};

    const newSendStateByConversationId = reduce(
      sendActions,
      (
        result: SendStateByConversationId,
        { destinationConversationId, action }
      ) => {
        const oldSendState = getOwn(result, destinationConversationId);
        if (!oldSendState) {
          log.warn(
            `${logId}: Got a receipt for a conversation (${destinationConversationId}), but we have no record of sending to them`
          );
          return result;
        }

        const newSendState = sendStateReducer(oldSendState, action);
        return {
          ...result,
          [destinationConversationId]: newSendState,
        };
      },
      oldSendStateByConversationId
    );

    if (!isEqual(oldSendStateByConversationId, newSendStateByConversationId)) {
      message.set('sendStateByConversationId', newSendStateByConversationId);
      changed = true;
    }
  }

  if (type === 'incoming') {
    // In a followup (see DESKTOP-2100), we want to make `ReadSyncs#forMessage` return
    //   an array, not an object. This array wrapping makes that future a bit easier.
    const readSync = ReadSyncs.forMessage(message);
    const readSyncs = readSync ? [readSync] : [];

    const viewSyncs = ViewSyncs.forMessage(message);

    const isGroupStoryReply =
      isGroup(conversation.attributes) && message.get('storyId');

    if (readSyncs.length !== 0 || viewSyncs.length !== 0) {
      const markReadAt = Math.min(
        Date.now(),
        ...readSyncs.map(sync => sync.readAt),
        ...viewSyncs.map(sync => sync.viewedAt)
      );

      if (message.get('expireTimer')) {
        const existingExpirationStartTimestamp = message.get(
          'expirationStartTimestamp'
        );
        message.set(
          'expirationStartTimestamp',
          Math.min(existingExpirationStartTimestamp ?? Date.now(), markReadAt)
        );
        changed = true;
      }

      let newReadStatus: ReadStatus.Read | ReadStatus.Viewed;
      if (viewSyncs.length) {
        newReadStatus = ReadStatus.Viewed;
      } else {
        strictAssert(
          readSyncs.length !== 0,
          'Should have either view or read syncs'
        );
        newReadStatus = ReadStatus.Read;
      }

      message.set({
        readStatus: newReadStatus,
        seenStatus: SeenStatus.Seen,
      });
      changed = true;

      message.setPendingMarkRead(
        Math.min(message.getPendingMarkRead() ?? Date.now(), markReadAt)
      );
    } else if (
      isFirstRun &&
      !isGroupStoryReply &&
      canConversationBeUnarchived(conversation.attributes)
    ) {
      conversation.setArchived(false);
    }

    if (!isFirstRun && message.getPendingMarkRead()) {
      const markReadAt = message.getPendingMarkRead();
      message.setPendingMarkRead(undefined);
      const newestSentAt = readSync?.timestamp;

      // This is primarily to allow the conversation to mark all older
      // messages as read, as is done when we receive a read sync for
      // a message we already know about.
      //
      // We run message when `isFirstRun` is false so that it triggers when the
      // message and the other ones accompanying it in the batch are fully in
      // the database.
      drop(
        message
          .getConversation()
          ?.onReadMessage(message, markReadAt, newestSentAt)
      );
    }

    // Check for out-of-order view once open syncs
    if (isTapToView(message.attributes)) {
      const viewOnceOpenSync = ViewOnceOpenSyncs.forMessage(message);
      if (viewOnceOpenSync) {
        await message.markViewOnceMessageViewed({ fromSync: true });
        changed = true;
      }
    }
  }

  if (isStory(message.attributes)) {
    const viewSyncs = ViewSyncs.forMessage(message);

    if (viewSyncs.length !== 0) {
      message.set({
        readStatus: ReadStatus.Viewed,
        seenStatus: SeenStatus.Seen,
      });
      changed = true;

      const markReadAt = Math.min(
        Date.now(),
        ...viewSyncs.map(sync => sync.viewedAt)
      );
      message.setPendingMarkRead(
        Math.min(message.getPendingMarkRead() ?? Date.now(), markReadAt)
      );
    }

    if (!message.get('expirationStartTimestamp')) {
      log.info(`${logId}: setting story expiration`, {
        expirationStartTimestamp: message.get('timestamp'),
        expireTimer: message.get('expireTimer'),
      });
      message.set('expirationStartTimestamp', message.get('timestamp'));
      changed = true;
    }
  }

  // Does message message have any pending, previously-received associated reactions?
  const reactions = Reactions.forMessage(message);
  await Promise.all(
    reactions.map(async reaction => {
      if (isStory(message.attributes)) {
        // We don't set changed = true here, because we don't modify the original story
        const generatedMessage = reaction.storyReactionMessage;
        strictAssert(
          generatedMessage,
          'Story reactions must provide storyReactionMessage'
        );
        await generatedMessage.handleReaction(reaction, {
          storyMessage: message.attributes,
        });
      } else {
        changed = true;
        await message.handleReaction(reaction, { shouldPersist: false });
      }
    })
  );

  // Does message message have any pending, previously-received associated
  // delete for everyone messages?
  const deletes = Deletes.forMessage(message.attributes);
  await Promise.all(
    deletes.map(async del => {
      await deleteForEveryone(message, del, false);
      changed = true;
    })
  );

  // We save here before handling any edits because handleEditMessage does its own saves
  if (changed && !isFirstRun) {
    log.info(`${logId}: Changes in second run; saving.`);
    await window.Signal.Data.saveMessage(message.attributes, {
      ourAci,
    });
  }

  // We want to make sure the message is saved first before applying any edits
  if (!isFirstRun && !skipEdits) {
    const edits = Edits.forMessage(message.attributes);
    log.info(`${logId}: ${edits.length} edits in second run`);
    await Promise.all(
      edits.map(editAttributes =>
        conversation.queueJob('modifyTargetMessage/edits', () =>
          handleEditMessage(message.attributes, editAttributes)
        )
      )
    );
  }
}
