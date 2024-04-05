import classNames from 'classnames';
import { isNil, isString, toNumber } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import { contextMenu } from 'react-contexify';
import { useSelector } from 'react-redux';
import styled, { keyframes } from 'styled-components';
import { useIsDetailMessageView } from '../../../../contexts/isDetailViewContext';
import { MessageRenderingProps } from '../../../../models/messageType';
import { getConversationController } from '../../../../session/conversations';
import { StateType } from '../../../../state/reducer';
import { useMessageSelected } from '../../../../state/selectors';
import {
  getGenericReadableMessageSelectorProps,
  isMessageSelectionMode,
} from '../../../../state/selectors/conversations';
import { MessageContentWithStatuses } from '../message-content/MessageContentWithStatus';
import { StyledMessageReactionsContainer } from '../message-content/MessageReactions';

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
};

const highlightedMessageAnimation = keyframes`
  1% {
      background-color: var(--primary-color);
  }
`;

const StyledReadableMessage = styled.div<{
  selected: boolean;
  isDetailView: boolean;
  isRightClicked: boolean;
}>`
  display: flex;
  align-items: center;
  width: 100%;
  letter-spacing: 0.03rem;
  padding: ${props => (props.isDetailView ? '0' : 'var(--margins-xs) var(--margins-lg) 0')};

  &.message-highlighted {
    animation: ${highlightedMessageAnimation} 1s ease-in-out;
  }

  ${StyledMessageReactionsContainer} {
    margin-top: var(--margins-xs);
  }

  ${props =>
    !props.selected &&
    props.isRightClicked &&
    `background-color: var(--conversation-tab-background-selected-color);`}
`;

export const GenericReadableMessage = (props: Props) => {
  const isDetailView = useIsDetailMessageView();

  const { ctxMenuID, messageId } = props;

  const [enableReactions, setEnableReactions] = useState(true);

  const msgProps = useSelector((state: StateType) =>
    getGenericReadableMessageSelectorProps(state, props.messageId)
  );

  const isMessageSelected = useMessageSelected(props.messageId);

  const multiSelectMode = useSelector(isMessageSelectionMode);

  const [isRightClicked, setIsRightClicked] = useState(false);
  const onMessageLoseFocus = useCallback(() => {
    if (isRightClicked) {
      setIsRightClicked(false);
    }
  }, [isRightClicked]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      // this is quite dirty but considering that we want the context menu of the message to show on click on the attachment
      // and the context menu save attachment item to save the right attachment I did not find a better way for now.

      // Note: If you change this, also make sure to update the `saveAttachment()` in MessageContextMenu.tsx
      const enableContextMenu = !multiSelectMode && !msgProps?.isKickedFromGroup;
      const attachmentIndexStr = (e?.target as any)?.parentElement?.getAttribute?.(
        'data-attachmentindex'
      );
      const attachmentIndex =
        isString(attachmentIndexStr) && !isNil(toNumber(attachmentIndexStr))
          ? toNumber(attachmentIndexStr)
          : 0;

      if (enableContextMenu) {
        contextMenu.hideAll();
        contextMenu.show({
          id: ctxMenuID,
          event: e,
          props: {
            dataAttachmentIndex: attachmentIndex,
          },
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

  const selected = isMessageSelected || false;

  return (
    <StyledReadableMessage
      selected={selected}
      isDetailView={isDetailView}
      isRightClicked={isRightClicked}
      className={classNames(selected ? 'message-selected' : undefined)}
      onContextMenu={handleContextMenu}
      key={`readable-message-${messageId}`}
    >
      <MessageContentWithStatuses
        ctxMenuID={ctxMenuID}
        messageId={messageId}
        dataTestId={'message-content'}
        enableReactions={enableReactions}
      />
    </StyledReadableMessage>
  );
};
