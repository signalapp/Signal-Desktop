// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useCallback, type ReactNode } from 'react';
import { useSelector } from 'react-redux';
import { MediaContextMenu } from '../../components/conversation/media-gallery/MediaContextMenu.dom.js';
import { ForwardMessagesModalType } from '../../components/ForwardMessagesModal.dom.js';
import type {
  GenericMediaItemType,
  MediaItemType,
  LinkPreviewMediaItemType,
  ContactMediaItemType,
} from '../../types/MediaItem.std.js';
import type { LocalizerType } from '../../types/Util.std.js';
import { missingCaseError } from '../../util/missingCaseError.std.js';
import { strictAssert } from '../../util/assert.std.js';
import { startConversation } from '../../util/startConversation.dom.js';
import { drop } from '../../util/drop.std.js';
import {
  applyDeleteMessage,
  applyDeleteAttachmentFromMessage,
} from '../../util/deleteForMe.preload.js';
import {
  getConversationIdentifier,
  getAddressableMessage,
} from '../../util/syncIdentifiers.preload.js';
import { getMessageById } from '../../messages/getMessageById.preload.js';
import { createLogger } from '../../logging/log.std.js';
import { singleProtoJobQueue } from '../../jobs/singleProtoJobQueue.preload.js';
import { MessageSender } from '../../textsecure/SendMessage.preload.js';
import { getIntl } from '../selectors/user.std.js';
import { useConversationsActions } from '../ducks/conversations.preload.js';
import { useGlobalModalActions } from '../ducks/globalModals.preload.js';
import { useLookupContact } from './ContactDetail.preload.js';

const log = createLogger('MediaContextMenu');

export type PropsType = Readonly<{
  mediaItem: GenericMediaItemType;
  children: ReactNode;
}>;

async function doRemoveAttachment(
  mediaItem: GenericMediaItemType
): Promise<void> {
  if (
    mediaItem.type !== 'media' &&
    mediaItem.type !== 'audio' &&
    mediaItem.type !== 'document'
  ) {
    log.error(
      `Invalid media item type ${mediaItem.type} for removing attachment`
    );
    return;
  }

  const message = await getMessageById(mediaItem.message.id);
  if (message == null) {
    log.error(
      `Missing message ${mediaItem.message.id} for removing attachment`
    );
    return;
  }

  const convo = window.ConversationController.get(
    mediaItem.message.conversationId
  );
  if (convo == null) {
    log.error(`Missing conversation ${mediaItem.message.conversationId}`);
    return;
  }

  const addressableMessage = getAddressableMessage(message.attributes);
  const conversationIdentifier = getConversationIdentifier(convo.attributes);
  if (addressableMessage == null) {
    log.error(`Message ${mediaItem.message.id} is not addressable`);
    return;
  }

  const { attachment } = mediaItem;

  if (message.get('attachments')?.length === 1) {
    log.info(`Deleting whole message ${mediaItem.message.id}`);
    await applyDeleteMessage(message.attributes);

    await singleProtoJobQueue.add(
      MessageSender.getDeleteForMeSyncMessage([
        {
          type: 'delete-message',
          conversation: conversationIdentifier,
          message: addressableMessage,
          timestamp: Date.now(),
        },
      ])
    );
  } else {
    log.info(`Deleting a single attachment for ${mediaItem.message.id}`);
    const attachmentData = {
      clientUuid: attachment.clientUuid,
      fallbackDigest: attachment.digest,
      fallbackPlaintextHash: attachment.plaintextHash,
    };

    const found = await applyDeleteAttachmentFromMessage(
      message,
      attachmentData,
      {
        shouldSave: true,
        logId: 'MediaItem.removeAttachment',
      }
    );

    if (!found) {
      log.error(`Missing attachment for ${mediaItem.message.id}`);
      return;
    }

    await singleProtoJobQueue.add(
      MessageSender.getDeleteForMeSyncMessage([
        {
          type: 'delete-single-attachment',
          conversation: conversationIdentifier,
          message: addressableMessage,
          ...attachmentData,
          timestamp: Date.now(),
        },
      ])
    );
  }
}

type SpecificMenuPropsType<ItemType extends GenericMediaItemType> = Readonly<{
  mediaItem: ItemType;
  children: ReactNode;

  i18n: LocalizerType;
  showMessage: () => void;
}>;

function AttachmentContextMenu({
  mediaItem,
  children,
  ...rest
}: SpecificMenuPropsType<MediaItemType>) {
  const { saveAttachment: doSaveAttachment } = useConversationsActions();
  const { toggleForwardMessagesModal } = useGlobalModalActions();

  const saveAttachment = useCallback(() => {
    strictAssert(mediaItem.attachment.path, 'Attachment must be downloaded');

    doSaveAttachment(mediaItem.attachment, mediaItem.message.sentAt);
  }, [doSaveAttachment, mediaItem.attachment, mediaItem.message.sentAt]);

  const forwardAttachment = useCallback(() => {
    toggleForwardMessagesModal({
      type: ForwardMessagesModalType.ForwardAttachment,
      draft: {
        originalMessageId: mediaItem.message.id,
        hasContact: false,
        isSticker: false,
        attachments: [mediaItem.attachment],
        previews: [],
      },
    });
  }, [mediaItem.message.id, mediaItem.attachment, toggleForwardMessagesModal]);

  const removeAttachment = useCallback(() => {
    drop(doRemoveAttachment(mediaItem));
  }, [mediaItem]);

  return (
    <MediaContextMenu
      {...rest}
      saveAttachment={mediaItem.attachment.path ? saveAttachment : undefined}
      forwardAttachment={
        mediaItem.attachment.path ? forwardAttachment : undefined
      }
      removeAttachment={removeAttachment}
    >
      {children}
    </MediaContextMenu>
  );
}

function LinkPreviewContextMenu({
  mediaItem,
  children,
  ...rest
}: SpecificMenuPropsType<LinkPreviewMediaItemType>) {
  const { toggleForwardMessagesModal } = useGlobalModalActions();

  const forwardAttachment = useCallback(() => {
    toggleForwardMessagesModal({
      type: ForwardMessagesModalType.ForwardAttachment,
      draft: {
        originalMessageId: mediaItem.message.id,
        hasContact: false,
        isSticker: false,
        messageBody: mediaItem.preview.url,
        previews: [mediaItem.preview],
      },
    });
  }, [mediaItem.message.id, mediaItem.preview, toggleForwardMessagesModal]);

  const copyLink = useCallback(() => {
    drop(window.navigator.clipboard.writeText(mediaItem.preview.url));
  }, [mediaItem.preview.url]);

  return (
    <MediaContextMenu
      {...rest}
      forwardAttachment={forwardAttachment}
      copyLink={copyLink}
    >
      {children}
    </MediaContextMenu>
  );
}

function ContactContextMenu({
  mediaItem,
  children,
  ...rest
}: SpecificMenuPropsType<ContactMediaItemType>) {
  const { toggleForwardMessagesModal } = useGlobalModalActions();

  const contact = useLookupContact(mediaItem.contact);

  const forwardAttachment = useCallback(() => {
    toggleForwardMessagesModal({
      type: ForwardMessagesModalType.ForwardAttachment,
      draft: {
        originalMessageId: mediaItem.message.id,
        hasContact: true,
        isSticker: false,
        previews: [],
      },
    });
  }, [mediaItem.message.id, toggleForwardMessagesModal]);

  const messageContact = useCallback(() => {
    strictAssert(
      contact.firstNumber != null && contact.serviceId != null,
      'Expected service id for contact'
    );
    startConversation(contact.firstNumber, contact.serviceId);
  }, [contact]);

  return (
    <MediaContextMenu
      {...rest}
      messageContact={
        contact.firstNumber != null && contact.serviceId != null
          ? messageContact
          : undefined
      }
      forwardAttachment={forwardAttachment}
    >
      {children}
    </MediaContextMenu>
  );
}

export function SmartMediaContextMenu({
  mediaItem,
  children,
}: PropsType): JSX.Element {
  const i18n = useSelector(getIntl);

  const { showConversation } = useConversationsActions();

  const { message } = mediaItem;

  const showMessage = useCallback(() => {
    showConversation({
      conversationId: message.conversationId,
      messageId: message.id,
    });
  }, [showConversation, message.conversationId, message.id]);

  const common = {
    i18n,
    showMessage,
  };

  switch (mediaItem.type) {
    case 'media':
    case 'document':
    case 'audio':
      return (
        <AttachmentContextMenu {...common} mediaItem={mediaItem}>
          {children}
        </AttachmentContextMenu>
      );
    case 'link':
      return (
        <LinkPreviewContextMenu {...common} mediaItem={mediaItem}>
          {children}
        </LinkPreviewContextMenu>
      );
    case 'contact':
      return (
        <ContactContextMenu {...common} mediaItem={mediaItem}>
          {children}
        </ContactContextMenu>
      );
    default:
      throw missingCaseError(mediaItem);
  }
}
