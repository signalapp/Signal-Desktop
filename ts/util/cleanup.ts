// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import PQueue from 'p-queue';
import { batch } from 'react-redux';

import type { MessageAttributesType } from '../model-types.d';
import { deletePackReference } from '../types/Stickers';
import { isStory } from '../messages/helpers';
import { isDirectConversation } from './whatTypeOfConversation';
import * as log from '../logging/log';
import { getCallHistorySelector } from '../state/selectors/callHistory';
import {
  DirectCallStatus,
  GroupCallStatus,
  AdhocCallStatus,
} from '../types/CallDisposition';
import { getMessageIdForLogging } from './idForLogging';
import type { SingleProtoJobQueue } from '../jobs/singleProtoJobQueue';
import { MINUTE } from './durations';
import { drop } from './drop';

export async function cleanupMessages(
  messages: ReadonlyArray<MessageAttributesType>,
  {
    fromSync,
    markCallHistoryDeleted,
    singleProtoJobQueue,
  }: {
    fromSync?: boolean;
    markCallHistoryDeleted: (callId: string) => Promise<void>;
    singleProtoJobQueue: SingleProtoJobQueue;
  }
): Promise<void> {
  // First, handle any calls that need to be deleted
  const inMemoryQueue = new PQueue({ concurrency: 3, timeout: MINUTE * 30 });
  drop(
    inMemoryQueue.addAll(
      messages.map((message: MessageAttributesType) => async () => {
        await maybeDeleteCall(message, {
          fromSync,
          markCallHistoryDeleted,
          singleProtoJobQueue,
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

  window.MessageCache.__DEPRECATED$unregister(id);
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

  const replies = await window.Signal.Data.getRecentStoryReplies(
    storyId,
    pagination
  );

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
        const replyMessageModel = window.MessageCache.__DEPRECATED$register(
          reply.id,
          reply,
          'cleanupStoryReplies/group'
        );
        return replyMessageModel.eraseContents();
      })
    );
  } else {
    // Refresh the storyReplyContext data for 1:1 conversations
    await Promise.all(
      replies.map(async reply => {
        const model = window.MessageCache.__DEPRECATED$register(
          reply.id,
          reply,
          'cleanupStoryReplies/1:1'
        );
        await model.hydrateStoryContext(story, {
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
    markCallHistoryDeleted,
    singleProtoJobQueue,
  }: {
    fromSync?: boolean;
    markCallHistoryDeleted: (callId: string) => Promise<void>;
    singleProtoJobQueue: SingleProtoJobQueue;
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
  await markCallHistoryDeleted(callId);
  window.reduxActions.callHistory.removeCallHistory(callId);
}
