// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentType } from '../types/Attachment';
import type { EditAttributesType } from '../messageModifiers/Edits';
import type { EditHistoryType, MessageAttributesType } from '../model-types.d';
import type { LinkPreviewType } from '../types/message/LinkPreviews';
import * as log from '../logging/log';
import { ReadStatus } from '../messages/MessageReadStatus';
import dataInterface from '../sql/Client';
import { drop } from './drop';
import {
  getAttachmentSignature,
  isDownloaded,
  isVoiceMessage,
} from '../types/Attachment';
import { getMessageIdForLogging } from './idForLogging';
import { hasErrors } from '../state/selectors/message';
import { isIncoming, isOutgoing } from '../messages/helpers';
import { isDirectConversation } from './whatTypeOfConversation';
import { queueAttachmentDownloads } from './queueAttachmentDownloads';
import { shouldReplyNotifyUser } from './shouldReplyNotifyUser';

export async function handleEditMessage(
  mainMessage: MessageAttributesType,
  editAttributes: EditAttributesType
): Promise<void> {
  const idLog = `handleEditMessage(${getMessageIdForLogging(mainMessage)})`;

  // Verify that we can safely apply an edit to this type of message
  if (mainMessage.deletedForEveryone) {
    log.warn(`${idLog}: Cannot edit a DOE message`);
    return;
  }

  if (mainMessage.isViewOnce) {
    log.warn(`${idLog}: Cannot edit an isViewOnce message`);
    return;
  }

  if (mainMessage.contact && mainMessage.contact.length > 0) {
    log.warn(`${idLog}: Cannot edit a contact share`);
    return;
  }

  const hasVoiceMessage = mainMessage.attachments?.some(isVoiceMessage);
  if (hasVoiceMessage) {
    log.warn(`${idLog}: Cannot edit a voice message`);
    return;
  }

  const mainMessageModel = window.MessageController.register(
    mainMessage.id,
    mainMessage
  );

  // Pull out the edit history from the main message. If this is the first edit
  // then the original message becomes the first item in the edit history.
  const editHistory: Array<EditHistoryType> = mainMessage.editHistory || [
    {
      attachments: mainMessage.attachments,
      body: mainMessage.body,
      bodyRanges: mainMessage.bodyRanges,
      preview: mainMessage.preview,
      timestamp: mainMessage.timestamp,
    },
  ];

  // Race condition prevention check here. If we already have the timestamp
  // recorded as an edit we can safely drop handling this edit.
  const editedMessageExists = editHistory.some(
    edit => edit.timestamp === editAttributes.message.timestamp
  );
  if (editedMessageExists) {
    log.warn(`${idLog}: edited message is duplicate. Dropping.`);
    return;
  }

  const messageAttributesForUpgrade: MessageAttributesType = {
    ...editAttributes.message,
    ...editAttributes.dataMessage,
    // There are type conflicts between MessageAttributesType and protos passed in here
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as MessageAttributesType;

  const upgradedEditedMessageData =
    await window.Signal.Migrations.upgradeMessageSchema(
      messageAttributesForUpgrade
    );

  // Copies over the attachments from the main message if they're the same
  // and they have already been downloaded.
  const attachmentSignatures: Map<string, AttachmentType> = new Map();
  const previewSignatures: Map<string, LinkPreviewType> = new Map();

  mainMessage.attachments?.forEach(attachment => {
    if (!isDownloaded(attachment)) {
      return;
    }
    const signature = getAttachmentSignature(attachment);
    attachmentSignatures.set(signature, attachment);
  });
  mainMessage.preview?.forEach(preview => {
    if (!preview.image || !isDownloaded(preview.image)) {
      return;
    }
    const signature = getAttachmentSignature(preview.image);
    previewSignatures.set(signature, preview);
  });

  const nextEditedMessageAttachments =
    upgradedEditedMessageData.attachments?.map(attachment => {
      const signature = getAttachmentSignature(attachment);
      const existingAttachment = attachmentSignatures.get(signature);

      return existingAttachment || attachment;
    });

  const nextEditedMessagePreview = upgradedEditedMessageData.preview?.map(
    preview => {
      if (!preview.image) {
        return preview;
      }

      const signature = getAttachmentSignature(preview.image);
      const existingPreview = previewSignatures.get(signature);
      return existingPreview || preview;
    }
  );

  const editedMessage: EditHistoryType = {
    attachments: nextEditedMessageAttachments,
    body: upgradedEditedMessageData.body,
    bodyRanges: upgradedEditedMessageData.bodyRanges,
    preview: nextEditedMessagePreview,
    timestamp: upgradedEditedMessageData.timestamp,
  };

  // The edit history works like a queue where the newest edits are at the top.
  // Here we unshift the latest edit onto the edit history.
  editHistory.unshift(editedMessage);

  // Update all the editable attributes on the main message also updating the
  // edit history.
  mainMessageModel.set({
    attachments: editedMessage.attachments,
    body: editedMessage.body,
    bodyRanges: editedMessage.bodyRanges,
    editHistory,
    editMessageTimestamp: upgradedEditedMessageData.timestamp,
    preview: editedMessage.preview,
  });

  // Queue up any downloads in case they're different, update the fields if so.
  const updatedFields = await queueAttachmentDownloads(
    mainMessageModel.attributes
  );
  if (updatedFields) {
    mainMessageModel.set(updatedFields);
  }

  const conversation = window.ConversationController.get(editAttributes.fromId);

  // Send delivery receipts, but only for non-story sealed sender messages
  // and not for messages from unaccepted conversations.
  if (
    isIncoming(upgradedEditedMessageData) &&
    upgradedEditedMessageData.unidentifiedDeliveryReceived &&
    !hasErrors(upgradedEditedMessageData) &&
    conversation?.getAccepted()
  ) {
    // Note: We both queue and batch because we want to wait until we are done
    // processing incoming messages to start sending outgoing delivery receipts.
    // The queue can be paused easily.
    drop(
      window.Whisper.deliveryReceiptQueue.add(() => {
        window.Whisper.deliveryReceiptBatcher.add({
          messageId: mainMessage.id,
          conversationId: editAttributes.fromId,
          senderE164: editAttributes.message.source,
          senderUuid: editAttributes.message.sourceUuid,
          timestamp: editAttributes.message.timestamp,
          isDirectConversation: isDirectConversation(conversation.attributes),
        });
      })
    );
  }

  // For incoming edits, we mark the message as unread so that we're able to
  // send a read receipt for the message. In case we had already sent one for
  // the original message.
  const readStatus = isOutgoing(mainMessageModel.attributes)
    ? ReadStatus.Read
    : ReadStatus.Unread;

  // Save both the main message and the edited message for fast lookups
  drop(
    dataInterface.saveEditedMessage(
      mainMessageModel.attributes,
      window.textsecure.storage.user.getCheckedUuid().toString(),
      {
        fromId: editAttributes.fromId,
        messageId: mainMessage.id,
        readStatus,
        sentAt: upgradedEditedMessageData.timestamp,
      }
    )
  );

  drop(mainMessageModel.getConversation()?.updateLastMessage());

  // Update notifications
  if (conversation) {
    if (await shouldReplyNotifyUser(mainMessageModel, conversation)) {
      await conversation.notify(mainMessageModel);
    }
  }
}
