import classNames from 'classnames';
import React, { useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { replyToMessage } from '../../../../interactions/conversationInteractions';
import { MessageRenderingProps } from '../../../../models/messageType';
import { toggleSelectedMessageId } from '../../../../state/ducks/conversations';
import { updateReactListModal } from '../../../../state/ducks/modalDialog';
import {
  getMessageContentWithStatusesSelectorProps,
  isMessageSelectionMode,
} from '../../../../state/selectors/conversations';
import { Reactions } from '../../../../util/reactions';

import { MessageAuthorText } from './MessageAuthorText';
import { MessageContent } from './MessageContent';
import { MessageContextMenu } from './MessageContextMenu';
import { MessageReactions, StyledMessageReactions } from './MessageReactions';
import { MessageStatus } from './MessageStatus';

export type MessageContentWithStatusSelectorProps = Pick<
  MessageRenderingProps,
  'direction' | 'isDeleted' | 'isTrustedForAttachmentDownload'
> & { hasAttachments: boolean };

type Props = {
  messageId: string;
  ctxMenuID: string;
  isDetailView?: boolean;
  dataTestId?: string;
  enableReactions: boolean;
};
// tslint:disable: use-simple-attributes

const StyledMessageContentContainer = styled.div<{ direction: 'left' | 'right' }>`
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: ${props => (props.direction === 'left' ? 'flex-start' : 'flex-end')};
  width: 100%;

  ${StyledMessageReactions} {
    margin-right: var(--margins-sm);
  }
`;

const StyledMessageWithAuthor = styled.div<{ isIncoming: boolean }>`
  max-width: ${props => (props.isIncoming ? '100%' : 'calc(100% - 17px)')};
`;

export const MessageContentWithStatuses = (props: Props) => {
  const contentProps = useSelector(state =>
    getMessageContentWithStatusesSelectorProps(state as any, props.messageId)
  );
  const dispatch = useDispatch();

  const multiSelectMode = useSelector(isMessageSelectionMode);

  const onClickOnMessageOuterContainer = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (multiSelectMode && messageId) {
        event.preventDefault();
        event.stopPropagation();
        dispatch(toggleSelectedMessageId(messageId));
      }
    },
    [window.contextMenuShown, props?.messageId, multiSelectMode, props?.isDetailView]
  );

  const onDoubleClickReplyToMessage = (e: React.MouseEvent<HTMLDivElement>) => {
    const currentSelection = window.getSelection();
    const currentSelectionString = currentSelection?.toString() || undefined;

    if ((e.target as any).localName !== 'em-emoji-picker') {
      if (
        !currentSelectionString ||
        currentSelectionString.length === 0 ||
        !/\s/.test(currentSelectionString)
      ) {
        // if multiple word are selected, consider that this double click was actually NOT used to reply to
        // but to select
        void replyToMessage(messageId);
        currentSelection?.empty();
        e.preventDefault();
        return;
      }
    }
  };

  const { messageId, ctxMenuID, isDetailView, dataTestId, enableReactions } = props;
  if (!contentProps) {
    return null;
  }
  const { direction, isDeleted, hasAttachments, isTrustedForAttachmentDownload } = contentProps;
  const isIncoming = direction === 'incoming';

  const [popupReaction, setPopupReaction] = useState('');

  const handleMessageReaction = async (emoji: string) => {
    await Reactions.sendMessageReaction(messageId, emoji);
  };

  const handlePopupClick = () => {
    dispatch(updateReactListModal({ reaction: popupReaction, messageId }));
  };

  return (
    <StyledMessageContentContainer
      direction={isIncoming ? 'left' : 'right'}
      onMouseLeave={() => {
        setPopupReaction('');
      }}
    >
      <div
        className={classNames('module-message', `module-message--${direction}`)}
        role="button"
        onClick={onClickOnMessageOuterContainer}
        onDoubleClickCapture={onDoubleClickReplyToMessage}
        style={{
          width: hasAttachments && isTrustedForAttachmentDownload ? 'min-content' : 'auto',
        }}
        data-testid={dataTestId}
      >
        <MessageStatus
          dataTestId="msg-status-incoming"
          messageId={messageId}
          isCorrectSide={isIncoming}
        />
        <StyledMessageWithAuthor isIncoming={isIncoming}>
          <MessageAuthorText messageId={messageId} />

          <MessageContent messageId={messageId} isDetailView={isDetailView} />
        </StyledMessageWithAuthor>
        <MessageStatus
          dataTestId="msg-status-outgoing"
          messageId={messageId}
          isCorrectSide={!isIncoming}
        />
        {!isDeleted && (
          <MessageContextMenu
            messageId={messageId}
            contextMenuId={ctxMenuID}
            enableReactions={enableReactions}
          />
        )}
      </div>
      {enableReactions && (
        <MessageReactions
          messageId={messageId}
          onClick={handleMessageReaction}
          popupReaction={popupReaction}
          setPopupReaction={setPopupReaction}
          onPopupClick={handlePopupClick}
        />
      )}
    </StyledMessageContentContainer>
  );
};
