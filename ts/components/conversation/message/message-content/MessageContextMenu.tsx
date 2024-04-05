/* eslint-disable @typescript-eslint/no-misused-promises */
import React, { Dispatch, useCallback, useEffect, useRef, useState } from 'react';

import { isNumber } from 'lodash';
import { Item, ItemParams, Menu, useContextMenu } from 'react-contexify';
import { useDispatch } from 'react-redux';
import { useClickAway, useMouse } from 'react-use';
import styled from 'styled-components';
import { Data } from '../../../../data/data';

import { MessageInteraction } from '../../../../interactions';
import { replyToMessage } from '../../../../interactions/conversationInteractions';
import { deleteMessagesForX } from '../../../../interactions/conversations/unsendingInteractions';
import {
  addSenderAsModerator,
  removeSenderFromModerator,
} from '../../../../interactions/messageInteractions';
import { MessageRenderingProps } from '../../../../models/messageType';
import { pushUnblockToSend } from '../../../../session/utils/Toast';
import {
  openRightPanel,
  showMessageInfoView,
  toggleSelectedMessageId,
} from '../../../../state/ducks/conversations';
import { setRightOverlayMode } from '../../../../state/ducks/section';
import {
  useMessageAttachments,
  useMessageBody,
  useMessageDirection,
  useMessageIsDeletable,
  useMessageIsDeletableForEveryone,
  useMessageSender,
  useMessageSenderIsAdmin,
  useMessageServerTimestamp,
  useMessageStatus,
  useMessageTimestamp,
} from '../../../../state/selectors';
import {
  useSelectedConversationKey,
  useSelectedIsBlocked,
  useSelectedIsPublic,
  useSelectedWeAreAdmin,
  useSelectedWeAreModerator,
} from '../../../../state/selectors/selectedConversation';
import { saveAttachmentToDisk } from '../../../../util/attachmentsUtil';
import { Reactions } from '../../../../util/reactions';
import { SessionContextMenuContainer } from '../../../SessionContextMenuContainer';
import { SessionEmojiPanel, StyledEmojiPanel } from '../../SessionEmojiPanel';
import { MessageReactBar } from './MessageReactBar';

export type MessageContextMenuSelectorProps = Pick<
  MessageRenderingProps,
  | 'sender'
  | 'direction'
  | 'status'
  | 'isDeletable'
  | 'isSenderAdmin'
  | 'text'
  | 'serverTimestamp'
  | 'timestamp'
>;

type Props = { messageId: string; contextMenuId: string; enableReactions: boolean };

const StyledMessageContextMenu = styled.div`
  position: relative;

  .contexify {
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

const DeleteItem = ({ messageId }: { messageId: string }) => {
  const convoId = useSelectedConversationKey();
  const isPublic = useSelectedIsPublic();

  const isDeletable = useMessageIsDeletable(messageId);
  const isDeletableForEveryone = useMessageIsDeletableForEveryone(messageId);
  const messageStatus = useMessageStatus(messageId);

  const enforceDeleteServerSide = isPublic && messageStatus !== 'error';

  const onDelete = useCallback(() => {
    if (convoId) {
      void deleteMessagesForX([messageId], convoId, enforceDeleteServerSide);
    }
  }, [convoId, enforceDeleteServerSide, messageId]);

  if (!convoId || (isPublic && !isDeletableForEveryone) || (!isPublic && !isDeletable)) {
    return null;
  }

  return <Item onClick={onDelete}>{window.i18n('delete')}</Item>;
};

type MessageId = { messageId: string };

const AdminActionItems = ({ messageId }: MessageId) => {
  const convoId = useSelectedConversationKey();
  const isPublic = useSelectedIsPublic();
  const weAreModerator = useSelectedWeAreModerator();
  const weAreAdmin = useSelectedWeAreAdmin();
  const showAdminActions = (weAreAdmin || weAreModerator) && isPublic;

  const sender = useMessageSender(messageId);
  const isSenderAdmin = useMessageSenderIsAdmin(messageId);

  if (!convoId || !sender) {
    return null;
  }

  const addModerator = () => {
    void addSenderAsModerator(sender, convoId);
  };

  const removeModerator = () => {
    void removeSenderFromModerator(sender, convoId);
  };

  const onBan = () => {
    MessageInteraction.banUser(sender, convoId);
  };

  const onUnban = () => {
    MessageInteraction.unbanUser(sender, convoId);
  };

  return showAdminActions ? (
    <>
      <Item onClick={onBan}>{window.i18n('banUser')}</Item>
      <Item onClick={onUnban}>{window.i18n('unbanUser')}</Item>
      {isSenderAdmin ? (
        <Item onClick={removeModerator}>{window.i18n('removeFromModerators')}</Item>
      ) : (
        <Item onClick={addModerator}>{window.i18n('addAsModerator')}</Item>
      )}
    </>
  ) : null;
};

const RetryItem = ({ messageId }: MessageId) => {
  const direction = useMessageDirection(messageId);

  const status = useMessageStatus(messageId);
  const isOutgoing = direction === 'outgoing';

  const showRetry = status === 'error' && isOutgoing;
  const onRetry = useCallback(async () => {
    const found = await Data.getMessageById(messageId);
    if (found) {
      await found.retrySend();
    }
  }, [messageId]);
  return showRetry ? <Item onClick={onRetry}>{window.i18n('resend')}</Item> : null;
};

export const showMessageInfoOverlay = async ({
  messageId,
  dispatch,
}: {
  messageId: string;
  dispatch: Dispatch<any>;
}) => {
  const found = await Data.getMessageById(messageId);
  if (found) {
    dispatch(showMessageInfoView(messageId));
    dispatch(
      setRightOverlayMode({
        type: 'message_info',
        params: { messageId, visibleAttachmentIndex: 0 },
      })
    );
    dispatch(openRightPanel());
  } else {
    window.log.warn(`[showMessageInfoOverlay] Message ${messageId} not found in db`);
  }
};

export const MessageContextMenu = (props: Props) => {
  const { messageId, contextMenuId, enableReactions } = props;
  const dispatch = useDispatch();
  const { hideAll } = useContextMenu();

  const isSelectedBlocked = useSelectedIsBlocked();
  const convoId = useSelectedConversationKey();

  const direction = useMessageDirection(messageId);
  const status = useMessageStatus(messageId);
  const isDeletable = useMessageIsDeletable(messageId);
  const text = useMessageBody(messageId);
  const attachments = useMessageAttachments(messageId);
  const timestamp = useMessageTimestamp(messageId);
  const serverTimestamp = useMessageServerTimestamp(messageId);
  const sender = useMessageSender(messageId);

  const isOutgoing = direction === 'outgoing';
  const isSent = status === 'sent' || status === 'read'; // a read message should be replyable

  const emojiPanelRef = useRef<HTMLDivElement>(null);
  const [showEmojiPanel, setShowEmojiPanel] = useState(false);
  // emoji-mart v5.2.2 default dimensions
  const emojiPanelWidth = 354;
  const emojiPanelHeight = 435;

  const contextMenuRef = useRef(null);
  const { docX, docY } = useMouse(contextMenuRef);
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);

  const onVisibilityChange = useCallback(
    (isVisible: boolean) => {
      if (isVisible) {
        if (showEmojiPanel) {
          setShowEmojiPanel(false);
        }
        window.contextMenuShown = true;
        return;
      }
      // This function will called before the click event
      // on the message would trigger (and I was unable to
      // prevent propagation in this case), so use a short timeout
      setTimeout(() => {
        window.contextMenuShown = false;
      }, 100);
    },
    [showEmojiPanel]
  );

  const selectMessageText = window.i18n('selectMessage');

  const onReply = useCallback(() => {
    if (isSelectedBlocked) {
      pushUnblockToSend();
      return;
    }
    void replyToMessage(messageId);
  }, [isSelectedBlocked, messageId]);

  const copyText = useCallback(() => {
    MessageInteraction.copyBodyToClipboard(text);
  }, [text]);

  const onSelect = useCallback(() => {
    dispatch(toggleSelectedMessageId(messageId));
  }, [dispatch, messageId]);

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
    window.log.debug('closed due to lost focus');
    onCloseEmoji();
  };

  const onEmojiClick = async (args: any) => {
    const emoji = args.native ?? args;
    onCloseEmoji();
    await Reactions.sendMessageReaction(messageId, emoji);
  };

  const onEmojiKeyDown = (event: any) => {
    if (event.key === 'Escape' && showEmojiPanel) {
      onCloseEmoji();
    }
  };

  const saveAttachment = (e: ItemParams) => {
    // this is quite dirty but considering that we want the context menu of the message to show on click on the attachment
    // and the context menu save attachment item to save the right attachment I did not find a better way for now.
    // Note: If you change this, also make sure to update the `handleContextMenu()` in GenericReadableMessage.tsx
    const targetAttachmentIndex = isNumber(e?.props?.dataAttachmentIndex)
      ? e.props.dataAttachmentIndex
      : 0;
    e.event.stopPropagation();
    if (!attachments?.length || !convoId || !sender) {
      return;
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
      index: targetAttachmentIndex,
    });
  };

  useClickAway(emojiPanelRef, () => {
    onEmojiLoseFocus();
  });

  useEffect(() => {
    if (emojiPanelRef.current) {
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
  }, [emojiPanelWidth, emojiPanelHeight, mouseX, mouseY]);

  if (!convoId) {
    return null;
  }
  return (
    <StyledMessageContextMenu ref={contextMenuRef}>
      {enableReactions && showEmojiPanel && (
        <StyledEmojiPanelContainer role="button" x={mouseX} y={mouseY}>
          <SessionEmojiPanel
            ref={emojiPanelRef}
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onEmojiClicked={onEmojiClick}
            show={showEmojiPanel}
            isModal={true}
            onKeyDown={onEmojiKeyDown}
          />
        </StyledEmojiPanelContainer>
      )}
      <SessionContextMenuContainer>
        <Menu id={contextMenuId} onVisibilityChange={onVisibilityChange} animation="fade">
          {enableReactions && (
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            <MessageReactBar
              action={onEmojiClick}
              additionalAction={onShowEmoji}
              messageId={messageId}
            />
          )}
          {attachments?.length ? (
            <Item onClick={saveAttachment}>{window.i18n('downloadAttachment')}</Item>
          ) : null}
          <Item onClick={copyText}>{window.i18n('copyMessage')}</Item>
          {(isSent || !isOutgoing) && (
            <Item onClick={onReply}>{window.i18n('replyToMessage')}</Item>
          )}
          <Item
            onClick={() => {
              void showMessageInfoOverlay({ messageId, dispatch });
            }}
          >
            {window.i18n('moreInformation')}
          </Item>
          <RetryItem messageId={messageId} />
          {isDeletable ? <Item onClick={onSelect}>{selectMessageText}</Item> : null}
          <DeleteItem messageId={messageId} />
          <AdminActionItems messageId={messageId} />
        </Menu>
      </SessionContextMenuContainer>
    </StyledMessageContextMenu>
  );
};
