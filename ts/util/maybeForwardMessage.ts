// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentType } from '../types/Attachment';
import type { ConversationModel } from '../models/conversations';
import type { LinkPreviewType } from '../types/message/LinkPreviews';
import type { MessageAttributesType } from '../model-types.d';
import * as log from '../logging/log';
import { getMessageIdForLogging } from './idForLogging';
import { markAllAsApproved } from './markAllAsApproved';
import { markAllAsVerifiedDefault } from './markAllAsVerifiedDefault';
import { resetLinkPreview } from '../services/LinkPreview';
import { showSafetyNumberChangeDialog } from '../shims/showSafetyNumberChangeDialog';

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

  const conversations = conversationIds.map(id =>
    window.ConversationController.get(id)
  );

  const cannotSend = conversations.some(
    conversation =>
      conversation?.get('announcementsOnly') && !conversation.areWeAdmin()
  );
  if (cannotSend) {
    throw new Error('Cannot send to group');
  }

  // Verify that all contacts that we're forwarding
  // to are verified and trusted
  const unverifiedContacts: Array<ConversationModel> = [];
  const untrustedContacts: Array<ConversationModel> = [];
  await Promise.all(
    conversations.map(async conversation => {
      if (conversation) {
        await conversation.updateVerified();
        const unverifieds = conversation.getUnverified();
        if (unverifieds.length) {
          unverifieds.forEach(unverifiedConversation =>
            unverifiedContacts.push(unverifiedConversation)
          );
        }

        const untrusted = conversation.getUntrusted();
        if (untrusted.length) {
          untrusted.forEach(untrustedConversation =>
            untrustedContacts.push(untrustedConversation)
          );
        }
      }
    })
  );

  // If there are any unverified or untrusted contacts, show the
  // SendAnywayDialog and if we're fine with sending then mark all as
  // verified and trusted and continue the send.
  const iffyConversations = [...unverifiedContacts, ...untrustedContacts];
  if (iffyConversations.length) {
    const forwardMessageModal = document.querySelector<HTMLElement>(
      '.module-ForwardMessageModal'
    );
    if (forwardMessageModal) {
      forwardMessageModal.style.display = 'none';
    }
    const sendAnyway = await new Promise(resolve => {
      showSafetyNumberChangeDialog({
        contacts: iffyConversations,
        reject: () => {
          resolve(false);
        },
        resolve: () => {
          resolve(true);
        },
      });
    });

    if (!sendAnyway) {
      if (forwardMessageModal) {
        forwardMessageModal.style.display = 'block';
      }
      return false;
    }

    let verifyPromise: Promise<void> | undefined;
    let approvePromise: Promise<void> | undefined;
    if (unverifiedContacts.length) {
      verifyPromise = markAllAsVerifiedDefault(unverifiedContacts);
    }
    if (untrustedContacts.length) {
      approvePromise = markAllAsApproved(untrustedContacts);
    }
    await Promise.all([verifyPromise, approvePromise]);
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
