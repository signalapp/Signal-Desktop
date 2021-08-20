import React, { useCallback } from 'react';

import { AttachmentTypeWithPath } from '../../types/Attachment';
import { animation, Item, Menu } from 'react-contexify';

import { MessageInteraction } from '../../interactions';
import { getMessageById } from '../../data/data';
import { deleteMessagesById, replyToMessage } from '../../interactions/conversationInteractions';
import { showMessageDetailsView, toggleSelectedMessageId } from '../../state/ducks/conversations';
import { saveAttachmentToDisk } from '../../util/attachmentsUtil';
import {
  addSenderAsModerator,
  removeSenderFromModerator,
} from '../../interactions/messageInteractions';
import { MessageDeliveryStatus, MessageModelType } from '../../models/messageType';
import { pushUnblockToSend } from '../../session/utils/Toast';

export type PropsForMessageContextMenu = {
  messageId: string;
  authorPhoneNumber: string;
  direction: MessageModelType;
  timestamp: number;
  serverTimestamp?: number;
  convoId: string;
  isPublic?: boolean;
  isBlocked: boolean;
  attachments?: Array<AttachmentTypeWithPath>;
  status?: MessageDeliveryStatus | null;
  isOpenGroupV2?: boolean;
  isDeletable: boolean;
  text: string | null;
  isAdmin?: boolean;
  weAreAdmin?: boolean;
  contextMenuId: string;
};

export const MessageContextMenu = (props: PropsForMessageContextMenu) => {
  const {
    attachments,
    authorPhoneNumber,
    convoId,
    direction,
    status,
    isDeletable,
    messageId,
    contextMenuId,
    isPublic,
    isOpenGroupV2,
    weAreAdmin,
    isAdmin,
    text,
    serverTimestamp,
    timestamp,
    isBlocked,
  } = props;
  const showRetry = status === 'error' && direction === 'outgoing';
  const multipleAttachments = attachments && attachments.length > 1;

  const onContextMenuShown = useCallback(() => {
    window.contextMenuShown = true;
  }, []);

  const onContextMenuHidden = useCallback(() => {
    // This function will called before the click event
    // on the message would trigger (and I was unable to
    // prevent propagation in this case), so use a short timeout
    setTimeout(() => {
      window.contextMenuShown = false;
    }, 100);
  }, []);

  const onShowDetail = async () => {
    const found = await getMessageById(messageId);
    if (found) {
      const messageDetailsProps = await found.getPropsForMessageDetail();
      window.inboxStore?.dispatch(showMessageDetailsView(messageDetailsProps));
    } else {
      window.log.warn(`Message ${messageId} not found in db`);
    }
  };

  const selectMessageText = window.i18n('selectMessage');
  const deleteMessageText = window.i18n('deleteMessage');

  const addModerator = useCallback(() => {
    void addSenderAsModerator(authorPhoneNumber, convoId);
  }, [authorPhoneNumber, convoId]);

  const removeModerator = useCallback(() => {
    void removeSenderFromModerator(authorPhoneNumber, convoId);
  }, [authorPhoneNumber, convoId]);

  const onReply = useCallback(() => {
    if (isBlocked) {
      pushUnblockToSend();
      return;
    }
    void replyToMessage(messageId);
  }, [isBlocked, messageId]);

  const saveAttachment = useCallback(
    (e: any) => {
      e.event.stopPropagation();
      if (!attachments?.length) {
        return;
      }
      const messageTimestamp = timestamp || serverTimestamp || 0;
      void saveAttachmentToDisk({
        attachment: attachments[0],
        messageTimestamp,
        messageSender: authorPhoneNumber,
        conversationId: convoId,
      });
    },
    [convoId, authorPhoneNumber, timestamp, serverTimestamp, convoId, attachments]
  );

  const copyText = useCallback(() => {
    MessageInteraction.copyBodyToClipboard(text);
  }, [text]);

  const onRetry = useCallback(async () => {
    const found = await getMessageById(messageId);
    if (found) {
      await found.retrySend();
    }
  }, [messageId]);

  const onBan = useCallback(() => {
    MessageInteraction.banUser(authorPhoneNumber, convoId);
  }, [authorPhoneNumber, convoId]);

  const onBanAndDeleteAll = useCallback(() => {
    MessageInteraction.banUser(authorPhoneNumber, convoId, true);
  }, [authorPhoneNumber, convoId]);

  const onUnban = useCallback(() => {
    MessageInteraction.unbanUser(authorPhoneNumber, convoId);
  }, [authorPhoneNumber, convoId]);

  const onSelect = useCallback(() => {
    window.inboxStore?.dispatch(toggleSelectedMessageId(messageId));
  }, [messageId]);

  const onDelete = useCallback(() => {
    void deleteMessagesById([messageId], convoId, false);
  }, [convoId, messageId]);

  return (
    <Menu
      id={contextMenuId}
      onShown={onContextMenuShown}
      onHidden={onContextMenuHidden}
      animation={animation.fade}
    >
      {!multipleAttachments && attachments && attachments[0] ? (
        <Item onClick={saveAttachment}>{window.i18n('downloadAttachment')}</Item>
      ) : null}

      <Item onClick={copyText}>{window.i18n('copyMessage')}</Item>
      <Item onClick={onReply}>{window.i18n('replyToMessage')}</Item>
      <Item onClick={onShowDetail}>{window.i18n('moreInformation')}</Item>
      {showRetry ? <Item onClick={onRetry}>{window.i18n('resend')}</Item> : null}
      {isDeletable ? (
        <>
          <Item onClick={onSelect}>{selectMessageText}</Item>
          <Item onClick={onDelete}>{deleteMessageText}</Item>
        </>
      ) : null}
      {weAreAdmin && isPublic ? <Item onClick={onBan}>{window.i18n('banUser')}</Item> : null}
      {weAreAdmin && isPublic ? (
        <Item onClick={onBanAndDeleteAll}>{window.i18n('banUserAndDeleteAll')}</Item>
      ) : null}
      {weAreAdmin && isOpenGroupV2 ? (
        <Item onClick={onUnban}>{window.i18n('unbanUser')}</Item>
      ) : null}
      {weAreAdmin && isPublic && !isAdmin ? (
        <Item onClick={addModerator}>{window.i18n('addAsModerator')}</Item>
      ) : null}
      {weAreAdmin && isPublic && isAdmin ? (
        <Item onClick={removeModerator}>{window.i18n('removeFromModerators')}</Item>
      ) : null}
    </Menu>
  );
};
