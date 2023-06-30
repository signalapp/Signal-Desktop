// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentType } from '../types/Attachment';
import type { EditAttributesType } from '../messageModifiers/Edits';
import type {
  EditHistoryType,
  MessageAttributesType,
  QuotedMessageType,
} from '../model-types.d';
import type { LinkPreviewType } from '../types/message/LinkPreviews';
import * as durations from './durations';
import * as log from '../logging/log';
import { ReadStatus } from '../messages/MessageReadStatus';
import dataInterface from '../sql/Client';
import { drop } from './drop';
import { getAttachmentSignature, isVoiceMessage } from '../types/Attachment';
import { getMessageIdForLogging } from './idForLogging';
import { hasErrors } from '../state/selectors/message';
import { isIncoming, isOutgoing } from '../messages/helpers';
import { isOlderThan } from './timestamp';
import { isDirectConversation } from './whatTypeOfConversation';
import { queueAttachmentDownloads } from './queueAttachmentDownloads';

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

  const { serverTimestamp } = editAttributes.message;
  const isNoteToSelf =
    mainMessage.conversationId ===
    window.ConversationController.getOurConversationId();
  if (
    serverTimestamp &&
    !isNoteToSelf &&
    isOlderThan(serverTimestamp, durations.DAY)
  ) {
    log.warn(`${idLog}: cannot edit message older than 24h`, serverTimestamp);
    return;
  }

  const mainMessageModel = window.MessageController.register(
    mainMessage.id,
    mainMessage
  );

  // Pull out the edit history from the main message. If this is the first edit
  // then the original message becomes the first item in the edit history.
  let editHistory: Array<EditHistoryType> = mainMessage.editHistory || [
    {
      attachments: mainMessage.attachments,
      body: mainMessage.body,
      bodyRanges: mainMessage.bodyRanges,
      preview: mainMessage.preview,
      quote: mainMessage.quote,
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

  const upgradedEditedMessageData =
    await window.Signal.Migrations.upgradeMessageSchema(editAttributes.message);

  // Copies over the attachments from the main message if they're the same
  // and they have already been downloaded.
  const attachmentSignatures: Map<string, AttachmentType> = new Map();
  const previewSignatures: Map<string, LinkPreviewType> = new Map();
  const quoteSignatures: Map<string, AttachmentType> = new Map();

  mainMessage.attachments?.forEach(attachment => {
    const signature = getAttachmentSignature(attachment);
    if (signature) {
      attachmentSignatures.set(signature, attachment);
    }
  });
  mainMessage.preview?.forEach(preview => {
    if (!preview.image) {
      return;
    }
    const signature = getAttachmentSignature(preview.image);
    if (signature) {
      previewSignatures.set(signature, preview);
    }
  });
  if (mainMessage.quote) {
    for (const attachment of mainMessage.quote.attachments) {
      if (!attachment.thumbnail) {
        continue;
      }
      const signature = getAttachmentSignature(attachment.thumbnail);
      if (signature) {
        quoteSignatures.set(signature, attachment);
      }
    }
  }

  let newAttachments = 0;
  const nextEditedMessageAttachments =
    upgradedEditedMessageData.attachments?.map(attachment => {
      const signature = getAttachmentSignature(attachment);
      const existingAttachment = signature
        ? attachmentSignatures.get(signature)
        : undefined;

      if (existingAttachment) {
        return existingAttachment;
      }

      newAttachments += 1;
      return attachment;
    });

  let newPreviews = 0;
  const nextEditedMessagePreview = upgradedEditedMessageData.preview?.map(
    preview => {
      if (!preview.image) {
        return preview;
      }

      const signature = getAttachmentSignature(preview.image);
      const existingPreview = signature
        ? previewSignatures.get(signature)
        : undefined;
      if (existingPreview) {
        return existingPreview;
      }
      newPreviews += 1;
      return preview;
    }
  );

  let newQuoteThumbnails = 0;

  const { quote: upgradedQuote } = upgradedEditedMessageData;
  let nextEditedMessageQuote: QuotedMessageType | undefined;
  if (!upgradedQuote) {
    // Quote dropped
    log.info(`${idLog}: dropping quote`);
  } else if (!upgradedQuote.id || upgradedQuote.id === mainMessage.quote?.id) {
    // Quote preserved
    nextEditedMessageQuote = mainMessage.quote;
  } else {
    // Quote updated!
    nextEditedMessageQuote = {
      ...upgradedQuote,
      attachments: upgradedQuote.attachments.map(attachment => {
        if (!attachment.thumbnail) {
          return attachment;
        }
        const signature = getAttachmentSignature(attachment.thumbnail);
        const existingThumbnail = signature
          ? quoteSignatures.get(signature)
          : undefined;
        if (existingThumbnail) {
          return {
            ...attachment,
            thumbnail: existingThumbnail,
          };
        }

        newQuoteThumbnails += 1;
        return attachment;
      }),
    };
  }

  log.info(
    `${idLog}: editing message, added ${newAttachments} attachments, ` +
      `${newPreviews} previews, ${newQuoteThumbnails} quote thumbnails`
  );

  const editedMessage: EditHistoryType = {
    attachments: nextEditedMessageAttachments,
    body: upgradedEditedMessageData.body,
    bodyRanges: upgradedEditedMessageData.bodyRanges,
    preview: nextEditedMessagePreview,
    timestamp: upgradedEditedMessageData.timestamp,
    quote: nextEditedMessageQuote,
  };

  // The edit history works like a queue where the newest edits are at the top.
  // Here we unshift the latest edit onto the edit history.
  editHistory = [editedMessage, ...editHistory];

  // Update all the editable attributes on the main message also updating the
  // edit history.
  mainMessageModel.set({
    attachments: editedMessage.attachments,
    body: editedMessage.body,
    bodyRanges: editedMessage.bodyRanges,
    editHistory,
    editMessageTimestamp: upgradedEditedMessageData.timestamp,
    preview: editedMessage.preview,
    quote: editedMessage.quote,
  });

  // Queue up any downloads in case they're different, update the fields if so.
  const updatedFields = await queueAttachmentDownloads(
    mainMessageModel.attributes
  );
  if (updatedFields) {
    mainMessageModel.set(updatedFields);
  }

  const conversation = window.ConversationController.get(
    editAttributes.conversationId
  );

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
          conversationId: editAttributes.conversationId,
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
        conversationId: editAttributes.conversationId,
        messageId: mainMessage.id,
        readStatus,
        sentAt: upgradedEditedMessageData.timestamp,
      }
    )
  );

  drop(mainMessageModel.getConversation()?.updateLastMessage());
  if (conversation) {
    // Clear typing indicator
    const typingToken = `${editAttributes.fromId}.${editAttributes.fromDevice}`;
    conversation.clearContactTypingTimer(typingToken);
  }
}
