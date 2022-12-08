// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentType } from '../types/Attachment';
import type { LinkPreviewType } from '../types/message/LinkPreviews';
import type { MessageAttributesType } from '../model-types.d';
import * as log from '../logging/log';
import { SafetyNumberChangeSource } from '../components/SafetyNumberChangeDialog';
import { blockSendUntilConversationsAreVerified } from './blockSendUntilConversationsAreVerified';
import { getMessageIdForLogging } from './idForLogging';
import { isNotNil } from './isNotNil';
import { resetLinkPreview } from '../services/LinkPreview';
import { getRecipientsByConversation } from './getRecipientsByConversation';

export async function maybeForwardMessage(
  messageAttributes: MessageAttributesType,
  conversationIds: Array<string>,
  messageBody?: string,
  attachments?: Array<AttachmentType>,
  linkPreview?: LinkPreviewType
): Promise<boolean> {
  const idForLogging = getMessageIdForLogging(messageAttributes);
  log.info(`maybeForwardMessage/${idForLogging}: Starting...`);

  const attachmentLookup = new Set();
  if (attachments) {
    attachments.forEach(attachment => {
      attachmentLookup.add(`${attachment.fileName}/${attachment.contentType}`);
    });
  }

  const conversations = conversationIds
    .map(id => window.ConversationController.get(id))
    .filter(isNotNil);

  const cannotSend = conversations.some(
    conversation =>
      conversation?.get('announcementsOnly') && !conversation.areWeAdmin()
  );
  if (cannotSend) {
    throw new Error('Cannot send to group');
  }

  const recipientsByConversation = getRecipientsByConversation(
    conversations.map(x => x.attributes)
  );

  // Verify that all contacts that we're forwarding
  // to are verified and trusted.
  // If there are any unverified or untrusted contacts, show the
  // SendAnywayDialog and if we're fine with sending then mark all as
  // verified and trusted and continue the send.
  const canSend = await blockSendUntilConversationsAreVerified(
    recipientsByConversation,
    SafetyNumberChangeSource.MessageSend
  );
  if (!canSend) {
    return false;
  }

  const sendMessageOptions = { dontClearDraft: true };
  const baseTimestamp = Date.now();

  const {
    loadAttachmentData,
    loadContactData,
    loadPreviewData,
    loadStickerData,
  } = window.Signal.Migrations;

  // Actually send the message
  // load any sticker data, attachments, or link previews that we need to
  // send along with the message and do the send to each conversation.
  await Promise.all(
    conversations.map(async (conversation, offset) => {
      const timestamp = baseTimestamp + offset;
      if (conversation) {
        const { sticker, contact } = messageAttributes;

        if (sticker) {
          const stickerWithData = await loadStickerData(sticker);
          const stickerNoPath = stickerWithData
            ? {
                ...stickerWithData,
                data: {
                  ...stickerWithData.data,
                  path: undefined,
                },
              }
            : undefined;

          conversation.enqueueMessageForSend(
            {
              body: undefined,
              attachments: [],
              sticker: stickerNoPath,
            },
            { ...sendMessageOptions, timestamp }
          );
        } else if (contact?.length) {
          const contactWithHydratedAvatar = await loadContactData(contact);
          conversation.enqueueMessageForSend(
            {
              body: undefined,
              attachments: [],
              contact: contactWithHydratedAvatar,
            },
            { ...sendMessageOptions, timestamp }
          );
        } else {
          const preview = linkPreview
            ? await loadPreviewData([linkPreview])
            : [];
          const attachmentsWithData = await Promise.all(
            (attachments || []).map(async item => ({
              ...(await loadAttachmentData(item)),
              path: undefined,
            }))
          );
          const attachmentsToSend = attachmentsWithData.filter(
            (attachment: Partial<AttachmentType>) =>
              attachmentLookup.has(
                `${attachment.fileName}/${attachment.contentType}`
              )
          );

          conversation.enqueueMessageForSend(
            {
              body: messageBody || undefined,
              attachments: attachmentsToSend,
              preview,
            },
            { ...sendMessageOptions, timestamp }
          );
        }
      }
    })
  );

  // Cancel any link still pending, even if it didn't make it into the message
  resetLinkPreview();

  return true;
}
