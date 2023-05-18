import classNames from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import { contextMenu } from 'react-contexify';
import { useSelector } from 'react-redux';
// tslint:disable-next-line: no-submodule-imports
import _ from 'lodash';
import { MessageRenderingProps } from '../../../../models/messageType';
import { getConversationController } from '../../../../session/conversations';
import {
  getGenericReadableMessageSelectorProps,
  getIsMessageSelected,
  isMessageSelectionMode,
} from '../../../../state/selectors/conversations';
import { MessageContentWithStatuses } from '../message-content/MessageContentWithStatus';
import { ReadableMessage } from './ReadableMessage';
import styled, { keyframes } from 'styled-components';
import { ExpirableReadableMessage } from './ExpirableReadableMessage';

export type GenericReadableMessageSelectorProps = Pick<
  MessageRenderingProps,
  | 'direction'
  | 'conversationType'
  | 'receivedAt'
  | 'isUnread'
  | 'isKickedFromGroup'
  | 'convoId'
  | 'isDeleted'
>;

type Props = {
  messageId: string;
  ctxMenuID: string;
  isDetailView?: boolean;
};
// tslint:disable: use-simple-attributes

const highlightedMessageAnimation = keyframes`
  1% {
      background-color: var(--primary-color);
  }
`;

const StyledReadableMessage = styled(ReadableMessage)<{
  selected: boolean;
  isRightClicked: boolean;
}>`
  display: flex;
  align-items: center;
  width: 100%;
  letter-spacing: 0.03rem;
  padding: var(--margins-xs) var(--margins-lg) 0;

  &.message-highlighted {
    animation: ${highlightedMessageAnimation} 1s ease-in-out;
  }

  ${props =>
    props.isRightClicked &&
    `
    background-color: var(--conversation-tab-background-selected-color);
  `}

  ${props =>
    props.selected &&
    `
    &.message-selected {
      .module-message {
        &__container {
          box-shadow: var(--drop-shadow);
        }
      }
    }
    `}
`;

export const GenericReadableMessage = (props: Props) => {
  const { ctxMenuID, messageId, isDetailView } = props;

  const [enableReactions, setEnableReactions] = useState(true);

  const msgProps = useSelector(state =>
    getGenericReadableMessageSelectorProps(state as any, props.messageId)
  );

  const isMessageSelected = useSelector(state =>
    getIsMessageSelected(state as any, props.messageId)
  );
  const multiSelectMode = useSelector(isMessageSelectionMode);

  const [isRightClicked, setIsRightClicked] = useState(false);
  const onMessageLoseFocus = useCallback(() => {
    if (isRightClicked) {
      setIsRightClicked(false);
    }
  }, [isRightClicked]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const enableContextMenu = !multiSelectMode && !msgProps?.isKickedFromGroup;

      if (enableContextMenu) {
        contextMenu.hideAll();
        contextMenu.show({
          id: ctxMenuID,
          event: e,
        });
      }
      setIsRightClicked(enableContextMenu);
    },
    [ctxMenuID, multiSelectMode, msgProps?.isKickedFromGroup]
  );

  useEffect(() => {
    if (msgProps?.convoId) {
      const conversationModel = getConversationController().get(msgProps?.convoId);
      if (conversationModel) {
        setEnableReactions(conversationModel.hasReactions());
      }
    }
  }, [msgProps?.convoId]);

  useEffect(() => {
    document.addEventListener('click', onMessageLoseFocus);

    return () => {
      document.removeEventListener('click', onMessageLoseFocus);
    };
  }, [onMessageLoseFocus]);

  if (!msgProps) {
    return null;
  }
  const { conversationType, receivedAt, isUnread } = msgProps;

  const selected = isMessageSelected || false;
  const isGroup = conversationType === 'group';

  return (
    <StyledReadableMessage
      messageId={messageId}
      selected={selected}
      isRightClicked={isRightClicked}
      className={classNames(
        selected && 'message-selected',
        isGroup && 'public-chat-message-wrapper'
      )}
      onContextMenu={handleContextMenu}
      receivedAt={receivedAt}
      isUnread={!!isUnread}
      key={`readable-message-${messageId}`}
    >
      <ExpirableReadableMessage messageId={messageId}>
        <MessageContentWithStatuses
          ctxMenuID={ctxMenuID}
          messageId={messageId}
          isDetailView={isDetailView}
          dataTestId={`message-content-${messageId}`}
          enableReactions={enableReactions}
        />
      </ExpirableReadableMessage>
    </StyledReadableMessage>
  );
};
