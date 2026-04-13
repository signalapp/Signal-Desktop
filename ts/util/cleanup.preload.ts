// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import PQueue from 'p-queue';
import { batch } from 'react-redux';
import { pick } from 'lodash';

import type { MessageAttributesType } from '../model-types.d.ts';
import { MessageModel } from '../models/messages.preload.ts';

import * as Errors from '../types/errors.std.ts';
import { createLogger } from '../logging/log.std.ts';

import { MessageSender } from '../textsecure/SendMessage.preload.ts';
import { DataReader, DataWriter } from '../sql/Client.preload.ts';
import { deletePackReference } from '../types/Stickers.preload.ts';
import { isStory } from '../messages/helpers.std.ts';
import { isDirectConversation } from './whatTypeOfConversation.dom.ts';
import { getCallHistorySelector } from '../state/selectors/callHistory.std.ts';
import {
  DirectCallStatus,
  GroupCallStatus,
  AdhocCallStatus,
} from '../types/CallDisposition.std.ts';
import { getMessageIdForLogging } from './idForLogging.preload.ts';
import { singleProtoJobQueue } from '../jobs/singleProtoJobQueue.preload.ts';
import { MINUTE } from './durations/index.std.ts';
import { drop } from './drop.std.ts';
import {
  getFilePathsReferencedByAttachment,
  getFilePathsReferencedByMessage,
} from './messageFilePaths.std.ts';
import {
  deleteDownloadFile,
  maybeDeleteAttachmentFile,
} from './migrations.preload.ts';
import { hydrateStoryContext } from './hydrateStoryContext.preload.ts';
import { update as updateExpiringMessagesService } from '../services/expiringMessagesDeletion.preload.ts';
import { tapToViewMessagesDeletionService } from '../services/tapToViewMessagesDeletionService.preload.ts';
import { throttledUpdateBackupMediaDownloadProgress } from './updateBackupMediaDownloadProgress.preload.ts';
import { messageAttrsToPreserveAfterErase } from '../types/Message.std.ts';
import type { AttachmentType } from '../types/Attachment.std.ts';

const log = createLogger('cleanup');

export async function postSaveUpdates(): Promise<void> {
  updateExpiringMessagesService();
  tapToViewMessagesDeletionService.update();
}

export async function eraseMessageContents(
  message: MessageModel,
  reason:
    | 'view-once-viewed'
    | 'view-once-invalid'
    | 'view-once-expired'
    | 'view-once-sent'
    | 'unsupported-message'
    | 'delete-for-everyone',
  additionalProperties: Partial<MessageAttributesType> = {}
): Promise<void> {
  log.info(
    `Erasing data for message ${getMessageIdForLogging(message.attributes)}: ${reason}`
  );

  // Note: There are cases where we want to re-erase a given message. For example, when
  //   a viewed (or outgoing) View-Once message is deleted for everyone.

  const originalAttributes = message.attributes;
  const preservedAttributes = pick(
    message.attributes,
    ...messageAttrsToPreserveAfterErase
  );

  message.resetAllAttributes({
    ...preservedAttributes,
    isErased: true,
    ...additionalProperties,
  });

  window.ConversationController.get(
    message.attributes.conversationId
  )?.debouncedUpdateLastMessage();

  await window.MessageCache.saveMessage(message.attributes);

  // Cleanup files only after saving message so any files only referenced by that message
  // are properly deleted
  try {
    await cleanupFilesAndReferencesToMessage(originalAttributes);
  } catch (error) {
    log.error(
      `Error erasing data for message ${getMessageIdForLogging(message.attributes)}:`,
      Errors.toLogFormat(error)
    );
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
        await cleanupFilesAndReferencesToMessage(message);
      })
    )
  );
  await unloadedQueue.onIdle();

  drop(
    throttledUpdateBackupMediaDownloadProgress(
      DataReader.getBackupAttachmentDownloadProgress
    )
  );

  if (window.SignalCI) {
    messages.forEach(msg => {
      window.SignalCI?.handleEvent(`message:cleaned-up:${msg.id}`, null);
    });
  }
}

/** Removes a message from redux caches & MessageCache, but does NOT delete files on disk,
 * story replies, edit histories, attachments, etc. Should ONLY be called in conjunction
 * with deleteMessageData.  */
function cleanupMessageFromMemory(message: MessageAttributesType): void {
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
    // Delete all group replies
    await DataWriter.removeMessagesById(
      replies.map(reply => reply.id),
      { cleanupMessages }
    );
  } else {
    // Clean out the storyReplyContext data for 1:1 conversations; these remain in the
    // 1:1 timeline with a "story not found" message
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
    // oxlint-disable-next-line typescript/no-non-null-assertion
    messageId: lastMessageId!,
    // oxlint-disable-next-line typescript/no-non-null-assertion
    receivedAt: lastReceivedAt!,
  });
}

export async function cleanupFilesAndReferencesToMessage(
  message: MessageAttributesType
): Promise<void> {
  await cleanupAllMessageAttachmentFiles(message);

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

async function maybeDeleteCall(
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
      MessageSender.getDeleteCallEvent(callHistory)
    );
  }
  await DataWriter.markCallHistoryDeleted(callId);
  window.reduxActions.callHistory.removeCallHistory(callId);
}

export const cleanupAllMessageAttachmentFiles = async (
  message: MessageAttributesType
): Promise<void> => {
  const { externalAttachments, externalDownloads } =
    getFilePathsReferencedByMessage(message);
  await Promise.all(
    [...externalAttachments].map(attachmentPath =>
      maybeDeleteAttachmentFile(attachmentPath)
    )
  );
  await Promise.all(
    [...externalDownloads].map(downloadPath => deleteDownloadFile(downloadPath))
  );
};

export async function cleanupAttachmentFiles(
  attachment: AttachmentType
): Promise<void> {
  const result = getFilePathsReferencedByAttachment(attachment);
  await Promise.all(
    [...result.externalAttachments].map(maybeDeleteAttachmentFile)
  );
  await Promise.all([...result.externalDownloads].map(deleteDownloadFile));
}
