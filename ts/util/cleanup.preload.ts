// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import PQueue from 'p-queue';
import { batch } from 'react-redux';
import { pick } from 'lodash';

import type {
  ConversationAttributesType,
  MessageAttributesType,
} from '../model-types.d.ts';
import type { MessageModel } from '../models/messages.preload.ts';

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
  deleteAvatar,
  deleteDownloadFile,
  deleteDraftFile,
  maybeDeleteAttachmentFile,
} from './migrations.preload.ts';
import { update as updateExpiringMessagesService } from '../services/expiringMessagesDeletion.preload.ts';
import { tapToViewMessagesDeletionService } from '../services/tapToViewMessagesDeletionService.preload.ts';
import { throttledUpdateBackupMediaDownloadProgress } from './updateBackupMediaDownloadProgress.preload.ts';
import {
  getMessageAttrsToPreserveAfterErase,
  type EraseMessageReasonType,
} from '../types/Message.std.ts';
import type { AttachmentType } from '../types/Attachment.std.ts';
import {
  getExternalDraftFilesForConversation,
  getExternalAvatarFilesForConversation,
  getExternalAvatarDraftsForConversation,
} from './conversationFilePaths.std.ts';

const log = createLogger('cleanup');

export async function postSaveUpdates(): Promise<void> {
  updateExpiringMessagesService();
  tapToViewMessagesDeletionService.update();
}

export async function eraseMessageContents(
  message: MessageModel,
  reason: EraseMessageReasonType,
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
    ...getMessageAttrsToPreserveAfterErase(reason)
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

  // 1:1 story replies stay in the timeline
  if (!isGroupConversation) {
    return;
  }

  const replies = await DataReader.getRecentStoryReplies(storyId, pagination);

  const logId = `cleanupStoryReplies(${storyId})`;
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

  // Delete all group replies
  await DataWriter.removeMessagesById(
    replies.map(reply => reply.id),
    { cleanupMessages }
  );

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

  if (!fromSync && window.ConversationController.doWeHaveOtherDevices()) {
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

export async function safeCleanupDraftFiles(
  conversation: ConversationAttributesType
): Promise<void> {
  const result = getExternalDraftFilesForConversation(conversation);
  await Promise.all(
    result.map(async (relativeFile, index) => {
      try {
        await deleteDraftFile(relativeFile);
      } catch (error) {
        log.error(
          `safeCleanupDraftFiles: Failed to delete draft at index ${index}`,
          Errors.toLogFormat(error)
        );
      }
    })
  );
}

export async function safeCleanupAvatarFiles(
  conversation: ConversationAttributesType
): Promise<void> {
  const result = getExternalAvatarFilesForConversation(conversation);
  await Promise.all(result.map(maybeDeleteAttachmentFile));
}

export async function safeCleanupAvatarDraftFiles(
  conversation: ConversationAttributesType
): Promise<void> {
  const result = getExternalAvatarDraftsForConversation(conversation);
  await Promise.all(
    result.map(async (relativeFile, index) => {
      try {
        await deleteAvatar(relativeFile);
      } catch (error) {
        log.error(
          `safeCleanupAvatarDraftFiles: Failed to delete avatar draft at index ${index}`,
          Errors.toLogFormat(error)
        );
      }
    })
  );
}

export const GENERIC_CLEANUP_FIELDS: Partial<ConversationAttributesType> = {
  draftChanged: undefined,
  draftAttachments: undefined,
  draftBodyRanges: undefined,
  draftIsViewOnce: undefined,
  draftTimestamp: undefined,

  inbox_position: undefined,

  lastMessageDeletedForEveryone: undefined,
  lastMessageDeletedForEveryoneByAdminAci: undefined,
  lastMessageAuthorAci: undefined,
  lastMessage: undefined,
  lastMessageBodyRanges: undefined,
  lastMessagePrefix: undefined,
  lastMessageAuthor: undefined,
  lastMessageStatus: undefined,
  lastMessageReceivedAt: undefined,
  lastMessageReceivedAtMs: undefined,

  markedUnread: undefined,
  messageCount: undefined,
  messageCountBeforeMessageRequests: undefined,

  messagesDeleted: true,

  quotedMessageId: undefined,

  sentMessageCount: undefined,

  timestamp: undefined,
  unreadCount: undefined,
  unreadMentionsCount: undefined,

  active_at: undefined,
  draft: undefined,
  draftEditMessage: undefined,

  isArchived: undefined,

  pendingUniversalTimer: undefined,

  avatars: undefined,
};

export const GROUP_CLEANUP_FIELDS: Partial<ConversationAttributesType> = {
  addedBy: undefined,

  color: undefined,
  colorFromPrimary: undefined,
  conversationColor: undefined,
  customColor: undefined,
  customColorId: undefined,

  wallpaperPhotoPointerBase64: undefined,
  wallpaperPreset: undefined,
  dimWallpaperInDarkMode: undefined,
  autoBubbleColor: undefined,

  hideStory: undefined,

  isReported: undefined,
  name: undefined,

  pendingUniversalTimer: undefined,
  pendingRemovedContactNotification: undefined,
  reportingToken: undefined,

  left: undefined,
  storySendMode: undefined,
  groupVerifiedNameHash: undefined,

  members: undefined,
  derivedGroupV2Id: undefined,

  secretParams: undefined,
  publicParams: undefined,
  revision: undefined,
  senderKeyInfo: undefined,

  accessControl: undefined,
  announcementsOnly: undefined,
  avatar: undefined,
  avatars: undefined,
  description: undefined,
  expireTimer: undefined,
  expireTimerVersion: 1,
  membersV2: undefined,
  pendingMembersV2: undefined,
  pendingAdminApprovalV2: undefined,
  bannedMembersV2: undefined,
  groupInviteLinkPassword: undefined,
  previousGroupV1Id: undefined,
  previousGroupV1Members: undefined,
  acknowledgedGroupNameCollisions: undefined,

  isTemporary: undefined,
  temporaryMemberCount: undefined,

  unblurredAvatarPath: undefined,

  remoteAvatarUrl: undefined,
};
