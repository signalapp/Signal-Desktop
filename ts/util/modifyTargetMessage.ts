// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import PQueue from 'p-queue';
import type { ConversationModel } from '../models/conversations.js';
import type { MessageModel } from '../models/messages.js';
import type { SendStateByConversationId } from '../messages/MessageSendState.js';

import * as Edits from '../messageModifiers/Edits.js';
import { createLogger } from '../logging/log.js';
import * as Deletes from '../messageModifiers/Deletes.js';
import * as DeletesForMe from '../messageModifiers/DeletesForMe.js';
import * as MessageReceipts from '../messageModifiers/MessageReceipts.js';
import * as Reactions from '../messageModifiers/Reactions.js';
import * as ReadSyncs from '../messageModifiers/ReadSyncs.js';
import * as ViewOnceOpenSyncs from '../messageModifiers/ViewOnceOpenSyncs.js';
import * as ViewSyncs from '../messageModifiers/ViewSyncs.js';
import { ReadStatus } from '../messages/MessageReadStatus.js';
import { SeenStatus } from '../MessageSeenStatus.js';
import {
  SendActionType,
  sendStateReducer,
} from '../messages/MessageSendState.js';
import { canConversationBeUnarchived } from './canConversationBeUnarchived.js';
import { deleteForEveryone } from './deleteForEveryone.js';
import { drop } from './drop.js';
import { handleEditMessage } from './handleEditMessage.js';
import { isGroup } from './whatTypeOfConversation.js';
import { isStory, isTapToView } from '../state/selectors/message.js';
import { getOwn } from './getOwn.js';
import { getSourceServiceId } from '../messages/sources.js';
import { missingCaseError } from './missingCaseError.js';
import { reduce } from './iterables.js';
import { strictAssert } from './assert.js';
import {
  applyDeleteAttachmentFromMessage,
  applyDeleteMessage,
} from './deleteForMe.js';
import { getMessageIdForLogging } from './idForLogging.js';
import { markViewOnceMessageViewed } from '../services/MessageUpdater.js';
import { handleReaction } from '../messageModifiers/Reactions.js';
import {
  drainCachedTerminatesForMessage as drainCachedPollTerminatesForMessage,
  drainCachedVotesForMessage as drainCachedPollVotesForMessage,
  handlePollTerminate,
  handlePollVote,
} from '../messageModifiers/Polls.js';
import { itemStorage } from '../textsecure/Storage.js';

const { isEqual } = lodash;

const log = createLogger('modifyTargetMessage');

export enum ModifyTargetMessageResult {
  Modified = 'Modified',
  NotModified = 'MotModified',
  Deleted = 'Deleted',
}

// This function is called twice - once from handleDataMessage, and then again from
//    saveAndNotify, a function called at the end of handleDataMessage as a cleanup for
//    any missed out-of-order events.
export async function modifyTargetMessage(
  message: MessageModel,
  conversation: ConversationModel,
  options?: { isFirstRun: boolean; skipEdits: boolean }
): Promise<ModifyTargetMessageResult> {
  const { isFirstRun = false, skipEdits = false } = options ?? {};

  const logId = `modifyTargetMessage/${getMessageIdForLogging(message.attributes)}`;
  const type = message.get('type');
  let changed = false;
  const ourAci = itemStorage.user.getCheckedAci();
  const sourceServiceId = getSourceServiceId(message.attributes);

  const syncDeletes = await DeletesForMe.forMessage(message.attributes);
  if (syncDeletes.length) {
    const attachmentDeletes = syncDeletes.filter(
      item => item.deleteAttachmentData
    );
    const isFullDelete = attachmentDeletes.length !== syncDeletes.length;

    if (isFullDelete) {
      if (!isFirstRun) {
        await applyDeleteMessage(message.attributes, logId);
      }

      return ModifyTargetMessageResult.Deleted;
    }

    log.warn(
      `${logId}: Applying ${attachmentDeletes.length} attachment deletes in order`
    );
    const deleteQueue = new PQueue({ concurrency: 1 });
    await deleteQueue.addAll(
      attachmentDeletes.map(item => async () => {
        if (!item.deleteAttachmentData) {
          log.warn(
            `${logId}: attachmentDeletes list had item with no deleteAttachmentData`
          );
          return;
        }
        const result = await applyDeleteAttachmentFromMessage(
          message,
          item.deleteAttachmentData,
          {
            logId,
            shouldSave: false,
            deleteAttachmentOnDisk:
              window.Signal.Migrations.deleteAttachmentData,
            deleteDownloadOnDisk: window.Signal.Migrations.deleteDownloadData,
          }
        );
        if (result) {
          changed = true;
        }
      })
    );
  }

  if (type === 'outgoing' || (type === 'story' && ourAci === sourceServiceId)) {
    const receipts = await MessageReceipts.forMessage(message.attributes);
    const sendActions = receipts.map(({ receiptSync }) => {
      let sendActionType: SendActionType;
      const receiptType = receiptSync.type;
      switch (receiptType) {
        case MessageReceipts.messageReceiptTypeSchema.enum.Delivery:
          sendActionType = SendActionType.GotDeliveryReceipt;
          break;
        case MessageReceipts.messageReceiptTypeSchema.enum.Read:
          sendActionType = SendActionType.GotReadReceipt;
          break;
        case MessageReceipts.messageReceiptTypeSchema.enum.View:
          sendActionType = SendActionType.GotViewedReceipt;
          break;
        default:
          throw missingCaseError(receiptType);
      }

      return {
        destinationConversationId: receiptSync.sourceConversationId,
        action: {
          type: sendActionType,
          updatedAt: receiptSync.receiptTimestamp,
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
      message.set({ sendStateByConversationId: newSendStateByConversationId });
      changed = true;
    }
  }

  if (type === 'incoming') {
    // In a followup (see DESKTOP-2100), we want to make `ReadSyncs#forMessage` return
    //   an array, not an object. This array wrapping makes that future a bit easier.
    const maybeSingleReadSync = await ReadSyncs.forMessage(message.attributes);
    const readSyncs = maybeSingleReadSync ? [maybeSingleReadSync] : [];

    const viewSyncs = await ViewSyncs.forMessage(message.attributes);

    const isGroupStoryReply =
      isGroup(conversation.attributes) && message.get('storyId');

    if (readSyncs.length !== 0 || viewSyncs.length !== 0) {
      const markReadAt = Math.min(
        Date.now(),
        ...readSyncs.map(({ readSync }) => readSync.readAt),
        ...viewSyncs.map(({ viewSync }) => viewSync.viewedAt)
      );

      if (message.get('expireTimer')) {
        const existingExpirationStartTimestamp = message.get(
          'expirationStartTimestamp'
        );
        message.set({
          expirationStartTimestamp: Math.min(
            existingExpirationStartTimestamp ?? Date.now(),
            markReadAt
          ),
        });
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

      // eslint-disable-next-line no-param-reassign
      message.pendingMarkRead = Math.min(
        message.pendingMarkRead ?? Date.now(),
        markReadAt
      );
    } else if (
      isFirstRun &&
      !isGroupStoryReply &&
      canConversationBeUnarchived(conversation.attributes)
    ) {
      conversation.setArchived(false);
    }

    if (!isFirstRun && message.pendingMarkRead) {
      const markReadAt = message.pendingMarkRead;
      // eslint-disable-next-line no-param-reassign
      message.pendingMarkRead = undefined;

      // This is primarily to allow the conversation to mark all older
      // messages as read, as is done when we receive a read sync for
      // a message we already know about.
      //
      // We run message when `isFirstRun` is false so that it triggers when the
      // message and the other ones accompanying it in the batch are fully in
      // the database.
      drop(
        window.ConversationController.get(
          message.get('conversationId')
        )?.onReadMessage(message.attributes, markReadAt)
      );
    }

    // Check for out-of-order view once open syncs
    if (isTapToView(message.attributes)) {
      const viewOnceOpenSync = ViewOnceOpenSyncs.forMessage(message.attributes);
      if (viewOnceOpenSync) {
        await markViewOnceMessageViewed(message, { fromSync: true });
        changed = true;
      }
    }
  }

  if (isStory(message.attributes)) {
    const viewSyncs = await ViewSyncs.forMessage(message.attributes);

    if (viewSyncs.length !== 0) {
      message.set({
        readStatus: ReadStatus.Viewed,
        seenStatus: SeenStatus.Seen,
      });
      changed = true;

      const markReadAt = Math.min(
        Date.now(),
        ...viewSyncs.map(({ viewSync }) => viewSync.viewedAt)
      );
      // eslint-disable-next-line no-param-reassign
      message.pendingMarkRead = Math.min(
        message.pendingMarkRead ?? Date.now(),
        markReadAt
      );
    }

    if (!message.get('expirationStartTimestamp')) {
      log.info(`${logId}: setting story expiration`, {
        expirationStartTimestamp: message.get('timestamp'),
        expireTimer: message.get('expireTimer'),
      });
      message.set({ expirationStartTimestamp: message.get('timestamp') });
      changed = true;
    }
  }

  // Does message message have any pending, previously-received associated reactions?
  const reactions = Reactions.findReactionsForMessage(message.attributes);

  log.info(
    `${logId}: Found ${reactions.length} early reaction(s) for ${message.attributes.type} message`
  );
  await Promise.all(
    reactions.map(async reaction => {
      if (isStory(message.attributes)) {
        // We don't set changed = true here, because we don't modify the original story
        const generatedMessage = reaction.generatedMessageForStoryReaction;
        strictAssert(
          generatedMessage,
          'Story reactions must provide storyReactionMessage'
        );
        await handleReaction(generatedMessage, reaction, {
          storyMessage: message.attributes,
        });
      } else {
        changed = true;
        await handleReaction(message, reaction, { shouldPersist: false });
      }
    })
  );

  const pollVotes = drainCachedPollVotesForMessage(message.attributes);
  if (pollVotes.length) {
    changed = true;
    await Promise.all(
      pollVotes.map(vote =>
        handlePollVote(message, vote, { shouldPersist: false })
      )
    );
  }

  const pollTerminates = drainCachedPollTerminatesForMessage(
    message.attributes
  );
  if (pollTerminates.length) {
    changed = true;
    await Promise.all(
      pollTerminates.map(term =>
        handlePollTerminate(message, term, { shouldPersist: false })
      )
    );
  }

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
    await window.MessageCache.saveMessage(message.attributes);
  }

  // We want to make sure the message is saved first before applying any edits
  if (!isFirstRun && !skipEdits) {
    const edits = Edits.forMessage(message.attributes);
    log.info(`${logId}: ${edits.length} edits in second run`);
    edits.map(editAttributes =>
      drop(
        conversation.queueJob('modifyTargetMessage/edits', () =>
          handleEditMessage(message.attributes, editAttributes)
        )
      )
    );
  }

  return changed
    ? ModifyTargetMessageResult.Modified
    : ModifyTargetMessageResult.NotModified;
}
