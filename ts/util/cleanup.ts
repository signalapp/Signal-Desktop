// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import PQueue from 'p-queue';
import { batch } from 'react-redux';

import type { MessageAttributesType } from '../model-types.d';
import { MessageModel } from '../models/messages';

import * as Errors from '../types/errors';
import * as log from '../logging/log';

import { DataReader, DataWriter } from '../sql/Client';
import { deletePackReference } from '../types/Stickers';
import { isStory } from '../messages/helpers';
import { isDirectConversation } from './whatTypeOfConversation';
import { getCallHistorySelector } from '../state/selectors/callHistory';
import {
  DirectCallStatus,
  GroupCallStatus,
  AdhocCallStatus,
} from '../types/CallDisposition';
import { getMessageIdForLogging } from './idForLogging';
import { singleProtoJobQueue } from '../jobs/singleProtoJobQueue';
import { MINUTE } from './durations';
import { drop } from './drop';
import { hydrateStoryContext } from './hydrateStoryContext';
import { update as updateExpiringMessagesService } from '../services/expiringMessagesDeletion';
import { tapToViewMessagesDeletionService } from '../services/tapToViewMessagesDeletionService';

export async function postSaveUpdates(): Promise<void> {
  await updateExpiringMessagesService();
  await tapToViewMessagesDeletionService.update();
}

export async function eraseMessageContents(
  message: MessageModel,
  additionalProperties = {},
  shouldPersist = true
): Promise<void> {
  log.info(
    `Erasing data for message ${getMessageIdForLogging(message.attributes)}`
  );

  // Note: There are cases where we want to re-erase a given message. For example, when
  //   a viewed (or outgoing) View-Once message is deleted for everyone.

  try {
    await deleteMessageData(message.attributes);
  } catch (error) {
    log.error(
      `Error erasing data for message ${getMessageIdForLogging(message.attributes)}:`,
      Errors.toLogFormat(error)
    );
  }

  message.set({
    attachments: [],
    body: '',
    bodyRanges: undefined,
    contact: [],
    editHistory: undefined,
    isErased: true,
    preview: [],
    quote: undefined,
    sticker: undefined,
    ...additionalProperties,
  });
  window.ConversationController.get(
    message.attributes.conversationId
  )?.debouncedUpdateLastMessage();

  if (shouldPersist) {
    await window.MessageCache.saveMessage(message.attributes);
  }

  await DataWriter.deleteSentProtoByMessageId(message.id);
}

export async function cleanupMessages(
  messages: ReadonlyArray<MessageAttributesType>,
  {
    fromSync,
  }: {
    fromSync?: boolean;
  }
): Promise<void> {
  // First, handle any calls that need to be deleted
  const inMemoryQueue = new PQueue({ concurrency: 3, timeout: MINUTE * 30 });
  drop(
    inMemoryQueue.addAll(
      messages.map((message: MessageAttributesType) => async () => {
        await maybeDeleteCall(message, {
          fromSync,
        });
      })
    )
  );
  await inMemoryQueue.onIdle();

  // Then, remove messages from memory, so we can batch the updates in redux
  batch(() => {
    messages.forEach(message => cleanupMessageFromMemory(message));
  });

  // Then, handle any asynchronous actions (e.g. deleting data from disk)
  const unloadedQueue = new PQueue({ concurrency: 3, timeout: MINUTE * 30 });
  drop(
    unloadedQueue.addAll(
      messages.map((message: MessageAttributesType) => async () => {
        await deleteMessageData(message);
      })
    )
  );
  await unloadedQueue.onIdle();
}

/** Removes a message from redux caches & backbone, but does NOT delete files on disk,
 * story replies, edit histories, attachments, etc. Should ONLY be called in conjunction
 * with deleteMessageData.  */
export function cleanupMessageFromMemory(message: MessageAttributesType): void {
  const { id, conversationId } = message;

  window.reduxActions?.conversations.messageDeleted(id, conversationId);

  const parentConversation = window.ConversationController.get(conversationId);
  parentConversation?.debouncedUpdateLastMessage();

  window.MessageCache.unregister(id);
}

async function cleanupStoryReplies(
  story: MessageAttributesType,
  pagination?: {
    messageId: string;
    receivedAt: number;
  }
): Promise<void> {
  const storyId = story.id;
  const parentConversation = window.ConversationController.get(
    story.conversationId
  );
  const isGroupConversation = Boolean(
    parentConversation && !isDirectConversation(parentConversation.attributes)
  );

  const replies = await DataReader.getRecentStoryReplies(storyId, pagination);

  const logId = `cleanupStoryReplies(${storyId}/isGroup=${isGroupConversation})`;
  const lastMessage = replies[replies.length - 1];
  const lastMessageId = lastMessage?.id;
  const lastReceivedAt = lastMessage?.received_at;

  log.info(
    `${logId}: Cleaning ${replies.length} replies, ending with message ${lastMessageId}`
  );

  if (!replies.length) {
    return;
  }

  if (pagination?.messageId === lastMessageId) {
    log.info(
      `${logId}: Returning early; last message id is pagination starting id`
    );
    return;
  }

  if (isGroupConversation) {
    // Cleanup all group replies
    await Promise.all(
      replies.map(reply => {
        const replyMessageModel = window.MessageCache.register(
          new MessageModel(reply)
        );
        return eraseMessageContents(replyMessageModel);
      })
    );
  } else {
    // Refresh the storyReplyContext data for 1:1 conversations
    await Promise.all(
      replies.map(async reply => {
        const model = window.MessageCache.register(new MessageModel(reply));
        await hydrateStoryContext(model.id, story, {
          shouldSave: true,
          isStoryErased: true,
        });
      })
    );
  }

  return cleanupStoryReplies(story, {
    messageId: lastMessageId,
    receivedAt: lastReceivedAt,
  });
}

export async function deleteMessageData(
  message: MessageAttributesType
): Promise<void> {
  await window.Signal.Migrations.deleteExternalMessageFiles(message);

  if (isStory(message)) {
    await cleanupStoryReplies(message);
  }

  const { sticker } = message;
  if (!sticker) {
    return;
  }

  const { packId } = sticker;
  if (packId) {
    await deletePackReference(message.id, packId);
  }
}

export async function maybeDeleteCall(
  message: MessageAttributesType,
  {
    fromSync,
  }: {
    fromSync?: boolean;
  }
): Promise<void> {
  const { callId } = message;
  const logId = `maybeDeleteCall(${getMessageIdForLogging(message)})`;
  if (!callId) {
    return;
  }

  const callHistory = getCallHistorySelector(window.reduxStore.getState())(
    callId
  );
  if (!callHistory) {
    return;
  }

  if (
    callHistory.status === DirectCallStatus.Pending ||
    callHistory.status === GroupCallStatus.Joined ||
    callHistory.status === GroupCallStatus.OutgoingRing ||
    callHistory.status === GroupCallStatus.Ringing ||
    callHistory.status === AdhocCallStatus.Pending
  ) {
    log.warn(
      `${logId}: Call status is ${callHistory.status}; not deleting from Call Tab`
    );
    return;
  }

  if (!fromSync) {
    await singleProtoJobQueue.add(
      window.textsecure.MessageSender.getDeleteCallEvent(callHistory)
    );
  }
  await DataWriter.markCallHistoryDeleted(callId);
  window.reduxActions.callHistory.removeCallHistory(callId);
}
