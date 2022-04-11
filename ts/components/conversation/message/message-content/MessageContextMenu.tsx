import React, { useCallback } from 'react';

import { animation, Item, Menu } from 'react-contexify';

import { useDispatch, useSelector } from 'react-redux';
import { getMessageById } from '../../../../data/data';
import { MessageInteraction } from '../../../../interactions';
import { replyToMessage } from '../../../../interactions/conversationInteractions';
import {
  deleteMessagesById,
  deleteMessagesByIdForEveryone,
} from '../../../../interactions/conversations/unsendingInteractions';
import {
  addSenderAsModerator,
  removeSenderFromModerator,
} from '../../../../interactions/messageInteractions';
import { MessageRenderingProps } from '../../../../models/messageType';
import { pushUnblockToSend } from '../../../../session/utils/Toast';
import {
  showMessageDetailsView,
  toggleSelectedMessageId,
} from '../../../../state/ducks/conversations';
import { getMessageContextMenuProps } from '../../../../state/selectors/conversations';
import { saveAttachmentToDisk } from '../../../../util/attachmentsUtil';

export type MessageContextMenuSelectorProps = Pick<
  MessageRenderingProps,
  | 'attachments'
  | 'sender'
  | 'convoId'
  | 'direction'
  | 'status'
  | 'isDeletable'
  | 'isPublic'
  | 'isOpenGroupV2'
  | 'weAreAdmin'
  | 'isSenderAdmin'
  | 'text'
  | 'serverTimestamp'
  | 'timestamp'
  | 'isBlocked'
  | 'isDeletableForEveryone'
>;

type Props = { messageId: string; contextMenuId: string };

// tslint:disable: max-func-body-length cyclomatic-complexity
export const MessageContextMenu = (props: Props) => {
  const selected = useSelector(state => getMessageContextMenuProps(state as any, props.messageId));
  const dispatch = useDispatch();

  if (!selected) {
    return null;
  }
  const {
    attachments,
    sender,
    convoId,
    direction,
    status,
    isDeletable,
    isDeletableForEveryone,
    isPublic,
    isOpenGroupV2,
    weAreAdmin,
    isSenderAdmin,
    text,
    serverTimestamp,
    timestamp,
    isBlocked,
  } = selected;
  const { messageId, contextMenuId } = props;
  const isOutgoing = direction === 'outgoing';
  const showRetry = status === 'error' && isOutgoing;
  const isSent = status === 'sent' || status === 'read'; // a read message should be replyable

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
      dispatch(showMessageDetailsView(messageDetailsProps));
    } else {
      window.log.warn(`Message ${messageId} not found in db`);
    }
  };

  const selectMessageText = window.i18n('selectMessage');
  const deleteMessageJustForMeText = window.i18n('deleteJustForMe');
  const unsendMessageText = window.i18n('deleteForEveryone');

  const addModerator = useCallback(() => {
    void addSenderAsModerator(sender, convoId);
  }, [sender, convoId]);

  const removeModerator = useCallback(() => {
    void removeSenderFromModerator(sender, convoId);
  }, [sender, convoId]);

  const onReply = useCallback(() => {
    if (isBlocked) {
      pushUnblockToSend();
      return;
    }
    void replyToMessage(messageId);
  }, [isBlocked, messageId]);

  const saveAttachment = useCallback(
    (e: any) => {
      // this is quite dirty but considering that we want the context menu of the message to show on click on the attachment
      // and the context menu save attachment item to save the right attachment I did not find a better way for now.
      let targetAttachmentIndex = e.triggerEvent.path[1].getAttribute('data-attachmentindex');
      e.event.stopPropagation();
      if (!attachments?.length) {
        return;
      }

      if (!targetAttachmentIndex) {
        targetAttachmentIndex = 0;
      }
      if (targetAttachmentIndex > attachments.length) {
        return;
      }
      const messageTimestamp = timestamp || serverTimestamp || 0;
      void saveAttachmentToDisk({
        attachment: attachments[targetAttachmentIndex],
        messageTimestamp,
        messageSender: sender,
        conversationId: convoId,
      });
    },
    [convoId, sender, timestamp, serverTimestamp, convoId, attachments]
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
    MessageInteraction.banUser(sender, convoId);
  }, [sender, convoId]);

  const onUnban = useCallback(() => {
    MessageInteraction.unbanUser(sender, convoId);
  }, [sender, convoId]);

  const onSelect = useCallback(() => {
    dispatch(toggleSelectedMessageId(messageId));
  }, [messageId]);

  const onDelete = useCallback(() => {
    void deleteMessagesById([messageId], convoId);
  }, [convoId, messageId]);

  const onDeleteForEveryone = useCallback(() => {
    void deleteMessagesByIdForEveryone([messageId], convoId);
  }, [convoId, messageId]);

  return (
    <Menu
      id={contextMenuId}
      onShown={onContextMenuShown}
      onHidden={onContextMenuHidden}
      animation={animation.fade}
    >
      {attachments?.length ? (
        <Item onClick={saveAttachment}>{window.i18n('downloadAttachment')}</Item>
      ) : null}

      <Item onClick={copyText}>{window.i18n('copyMessage')}</Item>
      {(isSent || !isOutgoing) && <Item onClick={onReply}>{window.i18n('replyToMessage')}</Item>}
      {(!isPublic || isOutgoing) && (
        <Item onClick={onShowDetail}>{window.i18n('moreInformation')}</Item>
      )}
      {showRetry ? <Item onClick={onRetry}>{window.i18n('resend')}</Item> : null}
      {isDeletable ? (
        <>
          <Item onClick={onSelect}>{selectMessageText}</Item>
        </>
      ) : null}
      {isDeletable && !isPublic ? (
        <>
          <Item onClick={onDelete}>{deleteMessageJustForMeText}</Item>
        </>
      ) : null}
      {isDeletableForEveryone ? (
        <>
          <Item onClick={onDeleteForEveryone}>{unsendMessageText}</Item>
        </>
      ) : null}
      {weAreAdmin && isPublic ? <Item onClick={onBan}>{window.i18n('banUser')}</Item> : null}
      {weAreAdmin && isOpenGroupV2 ? (
        <Item onClick={onUnban}>{window.i18n('unbanUser')}</Item>
      ) : null}
      {weAreAdmin && isPublic && !isSenderAdmin ? (
        <Item onClick={addModerator}>{window.i18n('addAsModerator')}</Item>
      ) : null}
      {weAreAdmin && isPublic && isSenderAdmin ? (
        <Item onClick={removeModerator}>{window.i18n('removeFromModerators')}</Item>
      ) : null}
    </Menu>
  );
};
