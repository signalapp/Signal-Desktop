// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentType } from '../types/Attachment.std.js';
import type { LinkPreviewWithHydratedData } from '../types/message/LinkPreviews.std.js';
import type { QuotedMessageType } from '../model-types.d.ts';
import { createLogger } from '../logging/log.std.js';
import { SafetyNumberChangeSource } from '../types/SafetyNumberChangeSource.std.js';
import { blockSendUntilConversationsAreVerified } from './blockSendUntilConversationsAreVerified.dom.js';
import {
  getMessageIdForLogging,
  getConversationIdForLogging,
} from './idForLogging.preload.js';
import { isNotNil } from './isNotNil.std.js';
import { resetLinkPreview } from '../services/LinkPreview.preload.js';
import { getRecipientsByConversation } from './getRecipientsByConversation.dom.js';
import type { EmbeddedContactWithHydratedAvatar } from '../types/EmbeddedContact.std.js';
import type { DraftBodyRanges } from '../types/BodyRange.std.js';
import type { StickerWithHydratedData } from '../types/Stickers.preload.js';
import { drop } from './drop.std.js';
import {
  loadAttachmentData,
  loadContactData,
  loadPreviewData,
  loadStickerData,
} from './migrations.preload.js';
import { toLogFormat } from '../types/errors.std.js';
import {
  sortByMessageOrder,
  type ForwardMessageData,
} from '../types/ForwardDraft.std.js';
import { canForward } from '../state/selectors/message.preload.js';

const log = createLogger('maybeForwardMessages');

export async function maybeForwardMessages(
  messages: Array<ForwardMessageData>,
  conversationIds: ReadonlyArray<string>
): Promise<boolean> {
  log.info(
    `maybeForwardMessage: Attempting to forward ${messages.length} messages...`
  );

  const conversations = conversationIds
    .map(id => window.ConversationController.get(id))
    .filter(isNotNil);

  const areAllMessagesForwardable = messages.every(msg =>
    msg.originalMessage ? canForward(msg.originalMessage) : true
  );

  if (!areAllMessagesForwardable) {
    throw new Error(
      'maybeForwardMessage: Attempting to forward unforwardable message(s)'
    );
  }

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

  let timestampOffset = 0;

  // load any sticker data, attachments, or link previews that we need to
  // send along with the message and do the send to each conversation.
  const preparedMessages = await Promise.all(
    messages.map(async message => {
      const { draft, originalMessage } = message;
      const { sticker, contact } = originalMessage ?? {};
      const { attachments, bodyRanges, messageBody, previews } = draft;

      const idForLogging =
        originalMessage != null
          ? getMessageIdForLogging(originalMessage)
          : '(new message)';
      log.info(`maybeForwardMessage: Forwarding ${idForLogging}`);

      const attachmentLookup = new Set();
      if (attachments) {
        attachments.forEach(attachment => {
          attachmentLookup.add(
            `${attachment.fileName}/${attachment.contentType}`
          );
        });
      }

      let enqueuedMessage: {
        attachments: Array<AttachmentType>;
        body: string | undefined;
        bodyRanges?: DraftBodyRanges;
        contact?: Array<EmbeddedContactWithHydratedAvatar>;
        preview?: Array<LinkPreviewWithHydratedData>;
        quote?: QuotedMessageType;
        sticker?: StickerWithHydratedData;
      };

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

        enqueuedMessage = {
          body: undefined,
          attachments: [],
          sticker: stickerNoPath,
        };
      } else if (contact?.length) {
        const contactWithHydratedAvatar = await loadContactData(contact);
        enqueuedMessage = {
          body: undefined,
          attachments: [],
          contact: contactWithHydratedAvatar,
        };
      } else {
        const preview = await loadPreviewData([...previews]);
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

        enqueuedMessage = {
          body: messageBody || undefined,
          bodyRanges,
          attachments: attachmentsToSend,
          preview,
        };
      }

      return { originalMessage, enqueuedMessage };
    })
  );

  const sortedMessages = sortByMessageOrder(
    preparedMessages,
    message => message.originalMessage
  );

  // Actually send the messages
  conversations.forEach(conversation => {
    if (conversation == null) {
      return;
    }

    sortedMessages.forEach(entry => {
      const timestamp = baseTimestamp + timestampOffset;
      timestampOffset += 1;

      const { enqueuedMessage, originalMessage } = entry;
      drop(
        conversation
          .enqueueMessageForSend(enqueuedMessage, {
            ...sendMessageOptions,
            timestamp,
          })
          .catch(error => {
            log.error(
              'maybeForwardMessage: message send error',
              getConversationIdForLogging(conversation.attributes),
              originalMessage != null
                ? getMessageIdForLogging(originalMessage)
                : '(new message)',
              toLogFormat(error)
            );
          })
      );
    });
  });

  // Cancel any link still pending, even if it didn't make it into the message
  resetLinkPreview();

  return true;
}
