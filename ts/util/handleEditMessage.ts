// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentType } from '../types/Attachment.js';
import type { EditAttributesType } from '../messageModifiers/Edits.js';
import type {
  EditHistoryType,
  MessageAttributesType,
  QuotedMessageType,
} from '../model-types.d.ts';
import * as Edits from '../messageModifiers/Edits.js';
import { createLogger } from '../logging/log.js';
import { ReadStatus } from '../messages/MessageReadStatus.js';
import { DataWriter } from '../sql/Client.js';
import { drop } from './drop.js';
import { upgradeMessageSchema } from './migrations.js';
import {
  cacheAttachmentBySignature,
  getCachedAttachmentBySignature,
  isVoiceMessage,
} from './Attachment.js';
import { isAciString } from './isAciString.js';
import { getMessageIdForLogging } from './idForLogging.js';
import { hasErrors } from '../state/selectors/message.js';
import { isIncoming, isOutgoing } from '../messages/helpers.js';
import { isDirectConversation } from './whatTypeOfConversation.js';
import { isTooOldToModifyMessage } from './isTooOldToModifyMessage.js';
import { queueAttachmentDownloads } from './queueAttachmentDownloads.js';
import { modifyTargetMessage } from './modifyTargetMessage.js';
import { isMessageNoteToSelf } from './isMessageNoteToSelf.js';
import { MessageModel } from '../models/messages.js';
import { itemStorage } from '../textsecure/Storage.js';

const log = createLogger('handleEditMessage');

const RECURSION_LIMIT = 15;

export async function handleEditMessage(
  mainMessage: MessageAttributesType,
  editAttributes: Pick<
    EditAttributesType,
    'message' | 'conversationId' | 'fromDevice' | 'fromId'
  >,
  recursionCount = 0
): Promise<void> {
  const idLog = `handleEditMessage(edit=${
    editAttributes.message.timestamp
  },original=${getMessageIdForLogging(mainMessage)})`;

  if (recursionCount >= RECURSION_LIMIT) {
    log.warn(`${idLog}: Too much recursion`);
    return;
  }

  log.info(idLog);

  // Use local aci for outgoing messages and sourceServiceId for incoming.
  const senderAci = isOutgoing(mainMessage)
    ? itemStorage.user.getCheckedAci()
    : mainMessage.sourceServiceId;
  if (!isAciString(senderAci)) {
    log.warn(`${idLog}: Cannot edit a message from PNI source`);
    return;
  }

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

  if (
    serverTimestamp &&
    !isMessageNoteToSelf(mainMessage) &&
    isTooOldToModifyMessage(serverTimestamp, mainMessage)
  ) {
    log.warn(`${idLog}: cannot edit message older than 48h`, serverTimestamp);
    return;
  }

  const mainMessageModel = window.MessageCache.register(
    new MessageModel(mainMessage)
  );

  // Pull out the edit history from the main message. If this is the first edit
  // then the original message becomes the first item in the edit history.
  let editHistory: ReadonlyArray<EditHistoryType> = mainMessage.editHistory || [
    {
      attachments: mainMessage.attachments,
      body: mainMessage.body,
      bodyAttachment: mainMessage.bodyAttachment,
      bodyRanges: mainMessage.bodyRanges,
      preview: mainMessage.preview,
      quote: mainMessage.quote,
      sendStateByConversationId: { ...mainMessage.sendStateByConversationId },
      timestamp: mainMessage.timestamp,
      received_at: mainMessage.received_at,
      received_at_ms: mainMessage.received_at_ms,
      serverTimestamp: mainMessage.serverTimestamp,
      readStatus: mainMessage.readStatus,
      unidentifiedDeliveryReceived: mainMessage.unidentifiedDeliveryReceived,
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

  const upgradedEditedMessageData = await upgradeMessageSchema(
    editAttributes.message
  );

  // Copies over the attachments from the main message if they're the same
  // and they have already been downloaded.
  const attachmentSignatures: Map<string, AttachmentType> = new Map();
  const previewSignatures: Map<string, AttachmentType> = new Map();
  const quoteSignatures: Map<string, AttachmentType> = new Map();

  mainMessage.attachments?.forEach(attachment => {
    cacheAttachmentBySignature(attachmentSignatures, attachment);
  });
  mainMessage.preview?.forEach(preview => {
    if (!preview.image) {
      return;
    }
    cacheAttachmentBySignature(previewSignatures, preview.image);
  });
  if (mainMessage.quote) {
    for (const attachment of mainMessage.quote.attachments) {
      if (!attachment.thumbnail) {
        continue;
      }
      cacheAttachmentBySignature(quoteSignatures, attachment.thumbnail);
    }
  }

  let newAttachments = 0;
  const nextEditedMessageAttachments =
    upgradedEditedMessageData.attachments?.map(attachment => {
      const existingAttachment = getCachedAttachmentBySignature(
        attachmentSignatures,
        attachment
      );

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

      const existingPreviewImage = getCachedAttachmentBySignature(
        previewSignatures,
        preview.image
      );

      if (existingPreviewImage) {
        return { ...preview, image: existingPreviewImage };
      }
      newPreviews += 1;
      return preview;
    }
  );

  let newQuoteThumbnails = 0;

  const { quote: upgradedQuote } = upgradedEditedMessageData;
  let nextEditedMessageQuote: QuotedMessageType | undefined;
  if (!upgradedQuote) {
    if (mainMessage.quote) {
      // Quote dropped
      log.info(`${idLog}: dropping quote`);
    }
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

        const existingQuoteAttachment = getCachedAttachmentBySignature(
          quoteSignatures,
          attachment.thumbnail
        );

        if (existingQuoteAttachment) {
          return {
            ...attachment,
            thumbnail: existingQuoteAttachment.thumbnail,
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
    bodyAttachment: upgradedEditedMessageData.bodyAttachment,
    bodyRanges: upgradedEditedMessageData.bodyRanges,
    preview: nextEditedMessagePreview,
    sendStateByConversationId:
      upgradedEditedMessageData.sendStateByConversationId,
    timestamp: upgradedEditedMessageData.timestamp,
    received_at: upgradedEditedMessageData.received_at,
    received_at_ms: upgradedEditedMessageData.received_at_ms,
    serverTimestamp: upgradedEditedMessageData.serverTimestamp,
    readStatus: upgradedEditedMessageData.readStatus,
    unidentifiedDeliveryReceived:
      upgradedEditedMessageData.unidentifiedDeliveryReceived,
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
    bodyAttachment: editedMessage.bodyAttachment,
    bodyRanges: editedMessage.bodyRanges,
    editHistory,
    editMessageTimestamp: upgradedEditedMessageData.timestamp,
    editMessageReceivedAt: upgradedEditedMessageData.received_at,
    editMessageReceivedAtMs: upgradedEditedMessageData.received_at_ms,
    preview: editedMessage.preview,
    quote: editedMessage.quote,
  });

  // Queue up any downloads in case they're different, update the fields if so.
  const wasUpdated = await queueAttachmentDownloads(mainMessageModel, {
    isManualDownload: false,
  });

  // If we've scheduled a bodyAttachment download, we need that edit to know about it
  if (wasUpdated && mainMessageModel.get('bodyAttachment')) {
    const existing = mainMessageModel.get('editHistory') || [];

    mainMessageModel.set({
      editHistory: existing.map(item => {
        if (item.timestamp !== editedMessage.timestamp) {
          return item;
        }

        return {
          ...item,
          attachments: mainMessageModel.get('attachments'),
          bodyAttachment: mainMessageModel.get('bodyAttachment'),
        };
      }),
    });
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
          senderAci,
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
    DataWriter.saveEditedMessage(
      mainMessageModel.attributes,
      itemStorage.user.getCheckedAci(),
      {
        conversationId: editAttributes.conversationId,
        messageId: mainMessage.id,
        readStatus,
        sentAt: upgradedEditedMessageData.timestamp,
      }
    )
  );

  if (conversation) {
    // Clear typing indicator
    const typingToken = `${editAttributes.fromId}.${editAttributes.fromDevice}`;
    conversation.clearContactTypingTimer(typingToken);
  }

  const mainMessageConversation = window.ConversationController.get(
    mainMessageModel.get('conversationId')
  );
  if (mainMessageConversation) {
    drop(mainMessageConversation.updateLastMessage());
    // Apply any other operations, excluding edits that target this message
    await modifyTargetMessage(mainMessageModel, mainMessageConversation, {
      isFirstRun: false,
      skipEdits: true,
    });

    window.reduxActions.conversations.markOpenConversationRead(
      mainMessageConversation.id
    );
  }

  // Apply any other pending edits that target this message
  const edits = Edits.forMessage({
    ...mainMessageModel.attributes,
    sent_at: editedMessage.timestamp,
    timestamp: editedMessage.timestamp,
  });
  log.info(`${idLog}: ${edits.length} edits`);
  await Promise.all(
    edits.map(edit =>
      handleEditMessage(mainMessageModel.attributes, edit, recursionCount + 1)
    )
  );
}
