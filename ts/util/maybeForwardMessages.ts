// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { orderBy } from 'lodash';
import type { AttachmentType } from '../types/Attachment';
import type { LinkPreviewType } from '../types/message/LinkPreviews';
import type { MessageAttributesType, QuotedMessageType } from '../model-types';
import * as log from '../logging/log';
import { SafetyNumberChangeSource } from '../components/SafetyNumberChangeDialog';
import { blockSendUntilConversationsAreVerified } from './blockSendUntilConversationsAreVerified';
import {
  getMessageIdForLogging,
  getConversationIdForLogging,
} from './idForLogging';
import { isNotNil } from './isNotNil';
import { resetLinkPreview } from '../services/LinkPreview';
import { getRecipientsByConversation } from './getRecipientsByConversation';
import type { ContactWithHydratedAvatar } from '../textsecure/SendMessage';
import type { BodyRangesType } from '../types/Util';
import type { StickerWithHydratedData } from '../types/Stickers';
import { drop } from './drop';
import { toLogFormat } from '../types/errors';

export type MessageForwardDraft = Readonly<{
  originalMessageId: string;
  attachments?: ReadonlyArray<AttachmentType>;
  previews: ReadonlyArray<LinkPreviewType>;
  isSticker: boolean;
  hasContact: boolean;
  messageBody?: string;
}>;

export type ForwardMessageData = Readonly<{
  originalMessage: MessageAttributesType;
  draft: MessageForwardDraft;
}>;

export function isDraftEditable(draft: MessageForwardDraft): boolean {
  if (draft.isSticker) {
    return false;
  }
  if (draft.hasContact) {
    return false;
  }
  return true;
}

export function isDraftForwardable(draft: MessageForwardDraft): boolean {
  const messageLength = draft.messageBody?.length ?? 0;
  if (messageLength > 0) {
    return true;
  }
  if (draft.isSticker) {
    return true;
  }
  if (draft.hasContact) {
    return true;
  }
  const attachmentsLength = draft.attachments?.length ?? 0;
  if (attachmentsLength > 0) {
    return true;
  }
  return false;
}

export function isMessageForwardable(message: MessageAttributesType): boolean {
  const { body, attachments, sticker, contact } = message;
  const messageLength = body?.length ?? 0;
  if (messageLength > 0) {
    return true;
  }
  if (sticker) {
    return true;
  }
  if (contact?.length) {
    return true;
  }
  const attachmentsLength = attachments?.length ?? 0;
  if (attachmentsLength > 0) {
    return true;
  }
  return false;
}

export function sortByMessageOrder<T>(
  items: ReadonlyArray<T>,
  getMesssage: (
    item: T
  ) => Pick<MessageAttributesType, 'sent_at' | 'received_at'>
): Array<T> {
  return orderBy(
    items,
    [item => getMesssage(item).received_at, item => getMesssage(item).sent_at],
    ['ASC', 'ASC']
  );
}

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

  // load any sticker data, attachments, or link previews that we need to
  // send along with the message and do the send to each conversation.
  const preparedMessages = await Promise.all(
    messages.map(async message => {
      const { originalMessage, draft } = message;
      const { sticker, contact } = originalMessage;
      const { messageBody, previews, attachments } = draft;

      const idForLogging = getMessageIdForLogging(originalMessage);
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
        contact?: Array<ContactWithHydratedAvatar>;
        mentions?: BodyRangesType;
        preview?: Array<LinkPreviewType>;
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
  conversations.forEach((conversation, offset) => {
    if (conversation == null) {
      return;
    }
    const timestamp = baseTimestamp + offset;
    sortedMessages.forEach(entry => {
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
              getMessageIdForLogging(originalMessage),
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
