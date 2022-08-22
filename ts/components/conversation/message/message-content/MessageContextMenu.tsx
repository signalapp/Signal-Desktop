import React, { useCallback, useEffect, useRef, useState } from 'react';

import { animation, Item, Menu, useContextMenu } from 'react-contexify';

import { useDispatch, useSelector } from 'react-redux';
import { useClickAway, useMouse } from 'react-use';
import styled from 'styled-components';
import { Data } from '../../../../data/data';
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
import { StateType } from '../../../../state/reducer';
import { getMessageContextMenuProps } from '../../../../state/selectors/conversations';
import { saveAttachmentToDisk } from '../../../../util/attachmentsUtil';
import { sendMessageReaction } from '../../../../util/reactions';
import { SessionEmojiPanel, StyledEmojiPanel } from '../../SessionEmojiPanel';
import { MessageReactBar } from './MessageReactBar';

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

type Props = { messageId: string; contextMenuId: string; enableReactions: boolean };

const StyledMessageContextMenu = styled.div`
  position: relative;

  .react-contexify {
    margin-left: -104px;
  }
`;

const StyledEmojiPanelContainer = styled.div<{ x: number; y: number }>`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 101;

  ${StyledEmojiPanel} {
    position: absolute;
    left: ${props => `${props.x}px`};
    top: ${props => `${props.y}px`};
  }
`;

// tslint:disable: max-func-body-length cyclomatic-complexity
export const MessageContextMenu = (props: Props) => {
  const { messageId, contextMenuId, enableReactions } = props;
  const dispatch = useDispatch();
  const { hideAll } = useContextMenu();

  const selected = useSelector((state: StateType) => getMessageContextMenuProps(state, messageId));

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
    weAreAdmin,
    isSenderAdmin,
    text,
    serverTimestamp,
    timestamp,
    isBlocked,
  } = selected;

  const isOutgoing = direction === 'outgoing';
  const showRetry = status === 'error' && isOutgoing;
  const isSent = status === 'sent' || status === 'read'; // a read message should be replyable

  const emojiPanelRef = useRef<HTMLDivElement>(null);
  const [showEmojiPanel, setShowEmojiPanel] = useState(false);
  // emoji-mart v5.1 default dimensions
  const emojiPanelWidth = 354;
  const emojiPanelHeight = 435;

  const contextMenuRef = useRef(null);
  const { docX, docY } = useMouse(contextMenuRef);
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);

  const onContextMenuShown = () => {
    if (showEmojiPanel) {
      setShowEmojiPanel(false);
    }
    window.contextMenuShown = true;
  };

  const onContextMenuHidden = useCallback(() => {
    // This function will called before the click event
    // on the message would trigger (and I was unable to
    // prevent propagation in this case), so use a short timeout
    setTimeout(() => {
      window.contextMenuShown = false;
    }, 100);
  }, []);

  const onShowDetail = async () => {
    const found = await Data.getMessageById(messageId);
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
    const found = await Data.getMessageById(messageId);
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

  const onShowEmoji = () => {
    hideAll();
    setMouseX(docX);
    setMouseY(docY);
    setShowEmojiPanel(true);
  };

  const onCloseEmoji = () => {
    setShowEmojiPanel(false);
    hideAll();
  };

  const onEmojiLoseFocus = () => {
    window.log.info('closed due to lost focus');
    onCloseEmoji();
  };

  const onEmojiClick = async (args: any) => {
    const emoji = args.native ?? args;
    onCloseEmoji();
    await sendMessageReaction(messageId, emoji);
  };

  const onEmojiKeyDown = (event: any) => {
    if (event.key === 'Escape' && showEmojiPanel) {
      onCloseEmoji();
    }
  };

  useClickAway(emojiPanelRef, () => {
    onEmojiLoseFocus();
  });

  useEffect(() => {
    if (emojiPanelRef.current && emojiPanelRef.current) {
      const { innerWidth: windowWidth, innerHeight: windowHeight } = window;

      if (mouseX + emojiPanelWidth > windowWidth) {
        let x = mouseX;
        x = (mouseX + emojiPanelWidth - windowWidth) * 2;

        if (x === mouseX) {
          return;
        }
        setMouseX(mouseX - x);
      }

      if (mouseY + emojiPanelHeight > windowHeight) {
        const y = mouseY + emojiPanelHeight * 1.25 - windowHeight;

        if (y === mouseY) {
          return;
        }
        setMouseY(mouseY - y);
      }
    }
  }, [emojiPanelRef.current, emojiPanelWidth, emojiPanelHeight, mouseX, mouseY]);

  return (
    <StyledMessageContextMenu ref={contextMenuRef}>
      {enableReactions && showEmojiPanel && (
        <StyledEmojiPanelContainer role="button" x={mouseX} y={mouseY}>
          <SessionEmojiPanel
            ref={emojiPanelRef}
            onEmojiClicked={onEmojiClick}
            show={showEmojiPanel}
            isModal={true}
            onKeyDown={onEmojiKeyDown}
          />
        </StyledEmojiPanelContainer>
      )}
      <Menu
        id={contextMenuId}
        onShown={onContextMenuShown}
        onHidden={onContextMenuHidden}
        animation={animation.fade}
      >
        {enableReactions && (
          <MessageReactBar action={onEmojiClick} additionalAction={onShowEmoji} />
        )}
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
        {weAreAdmin && isPublic ? <Item onClick={onUnban}>{window.i18n('unbanUser')}</Item> : null}
        {weAreAdmin && isPublic && !isSenderAdmin ? (
          <Item onClick={addModerator}>{window.i18n('addAsModerator')}</Item>
        ) : null}
        {weAreAdmin && isPublic && isSenderAdmin ? (
          <Item onClick={removeModerator}>{window.i18n('removeFromModerators')}</Item>
        ) : null}
      </Menu>
    </StyledMessageContextMenu>
  );
};
