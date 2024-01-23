import classNames from 'classnames';
import React, { useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { replyToMessage } from '../../../../interactions/conversationInteractions';
import { MessageRenderingProps } from '../../../../models/messageType';
import { toggleSelectedMessageId } from '../../../../state/ducks/conversations';
import { updateReactListModal } from '../../../../state/ducks/modalDialog';
import { StateType } from '../../../../state/reducer';
import { useHideAvatarInMsgList } from '../../../../state/selectors';
import {
  getMessageContentWithStatusesSelectorProps,
  isMessageSelectionMode,
} from '../../../../state/selectors/conversations';
import { Reactions } from '../../../../util/reactions';
import { Flex } from '../../../basic/Flex';
import { ExpirableReadableMessage } from '../message-item/ExpirableReadableMessage';
import { MessageAuthorText } from './MessageAuthorText';
import { MessageContent } from './MessageContent';
import { MessageContextMenu } from './MessageContextMenu';
import { MessageReactions, StyledMessageReactions } from './MessageReactions';
import { MessageStatus } from './MessageStatus';

export type MessageContentWithStatusSelectorProps = { isGroup: boolean } & Pick<
  MessageRenderingProps,
  'conversationType' | 'direction' | 'isDeleted'
>;

type Props = {
  messageId: string;
  ctxMenuID: string;
  isDetailView?: boolean;
  dataTestId: string;
  enableReactions: boolean;
};

const StyledMessageContentContainer = styled.div<{ isIncoming: boolean }>`
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: ${props => (props.isIncoming ? 'flex-start' : 'flex-end')};
  width: 100%;

  ${StyledMessageReactions} {
    margin-right: var(--margins-md);
  }
`;

const StyledMessageWithAuthor = styled.div`
  max-width: '100%';
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

export const MessageContentWithStatuses = (props: Props) => {
  const contentProps = useSelector((state: StateType) =>
    getMessageContentWithStatusesSelectorProps(state, props.messageId)
  );
  const dispatch = useDispatch();
  const hideAvatar = useHideAvatarInMsgList(props.messageId);

  const multiSelectMode = useSelector(isMessageSelectionMode);

  const onClickOnMessageOuterContainer = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (multiSelectMode && props?.messageId) {
        event.preventDefault();
        event.stopPropagation();
        dispatch(toggleSelectedMessageId(props?.messageId));
      }
    },
    [dispatch, props?.messageId, multiSelectMode]
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
      }
    }
  };

  const { messageId, ctxMenuID, isDetailView = false, dataTestId, enableReactions } = props;
  const [popupReaction, setPopupReaction] = useState('');

  if (!contentProps) {
    return null;
  }

  const { direction: _direction, isDeleted } = contentProps;
  // NOTE we want messages on the left in the message detail view regardless of direction
  const direction = isDetailView ? 'incoming' : _direction;
  const isIncoming = direction === 'incoming';

  const handleMessageReaction = async (emoji: string) => {
    await Reactions.sendMessageReaction(messageId, emoji);
  };

  const handlePopupClick = () => {
    dispatch(
      updateReactListModal({
        reaction: popupReaction,
        messageId,
      })
    );
  };

  return (
    <StyledMessageContentContainer
      isIncoming={isIncoming}
      onMouseLeave={() => {
        setPopupReaction('');
      }}
    >
      <ExpirableReadableMessage
        messageId={messageId}
        className={classNames('module-message', `module-message--${direction}`)}
        role={'button'}
        isDetailView={isDetailView}
        onClick={onClickOnMessageOuterContainer}
        onDoubleClickCapture={onDoubleClickReplyToMessage}
        dataTestId={dataTestId}
      >
        <Flex container={true} flexDirection="column" flexShrink={0}>
          <StyledMessageWithAuthor>
            {!isDetailView && <MessageAuthorText messageId={messageId} />}
            <MessageContent messageId={messageId} isDetailView={isDetailView} />
          </StyledMessageWithAuthor>
          <MessageStatus
            dataTestId="msg-status"
            messageId={messageId}
            isDetailView={isDetailView}
          />
        </Flex>
        {!isDeleted && (
          <MessageContextMenu
            messageId={messageId}
            contextMenuId={ctxMenuID}
            enableReactions={enableReactions}
          />
        )}
      </ExpirableReadableMessage>
      {enableReactions && (
        <MessageReactions
          messageId={messageId}
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          onClick={handleMessageReaction}
          popupReaction={popupReaction}
          setPopupReaction={setPopupReaction}
          onPopupClick={handlePopupClick}
          noAvatar={hideAvatar}
          isDetailView={isDetailView}
        />
      )}
    </StyledMessageContentContainer>
  );
};
