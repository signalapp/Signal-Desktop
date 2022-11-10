import classNames from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import { contextMenu } from 'react-contexify';
import { useDispatch, useSelector } from 'react-redux';
// tslint:disable-next-line: no-submodule-imports
import useInterval from 'react-use/lib/useInterval';
import _ from 'lodash';
import { Data } from '../../../../data/data';
import { MessageRenderingProps } from '../../../../models/messageType';
import { getConversationController } from '../../../../session/conversations';
import { messagesExpired } from '../../../../state/ducks/conversations';
import {
  getGenericReadableMessageSelectorProps,
  getIsMessageSelected,
  isMessageSelectionMode,
} from '../../../../state/selectors/conversations';
import { getIncrement } from '../../../../util/timer';
import { ExpireTimer } from '../../ExpireTimer';
import { MessageAvatar } from '../message-content/MessageAvatar';
import { MessageContentWithStatuses } from '../message-content/MessageContentWithStatus';
import { ReadableMessage } from './ReadableMessage';
import styled, { keyframes } from 'styled-components';

export type GenericReadableMessageSelectorProps = Pick<
  MessageRenderingProps,
  | 'direction'
  | 'conversationType'
  | 'receivedAt'
  | 'isUnread'
  | 'expirationLength'
  | 'expirationTimestamp'
  | 'isKickedFromGroup'
  | 'isExpired'
  | 'convoId'
  | 'isDeleted'
>;

type ExpiringProps = {
  isExpired?: boolean;
  expirationTimestamp?: number | null;
  expirationLength?: number | null;
  convoId?: string;
  messageId: string;
};
const EXPIRATION_CHECK_MINIMUM = 2000;

function useIsExpired(props: ExpiringProps) {
  const {
    convoId,
    messageId,
    expirationLength,
    expirationTimestamp,
    isExpired: isExpiredProps,
  } = props;

  const dispatch = useDispatch();

  const [isExpired] = useState(isExpiredProps);

  const checkExpired = useCallback(async () => {
    const now = Date.now();

    if (!expirationTimestamp || !expirationLength) {
      return;
    }

    if (isExpired || now >= expirationTimestamp) {
      await Data.removeMessage(messageId);
      if (convoId) {
        dispatch(
          messagesExpired([
            {
              conversationKey: convoId,
              messageId,
            },
          ])
        );
        const convo = getConversationController().get(convoId);
        convo?.updateLastMessage();
      }
    }
  }, [expirationTimestamp, expirationLength, isExpired, messageId, convoId]);

  let checkFrequency: number | null = null;
  if (expirationLength) {
    const increment = getIncrement(expirationLength || EXPIRATION_CHECK_MINIMUM);
    checkFrequency = Math.max(EXPIRATION_CHECK_MINIMUM, increment);
  }

  useEffect(() => {
    void checkExpired();
  }, []); // check on mount
  useInterval(checkExpired, checkFrequency); // check every 2sec or sooner if needed

  return { isExpired };
}

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

  const expiringProps: ExpiringProps = {
    convoId: msgProps?.convoId,
    expirationLength: msgProps?.expirationLength,
    messageId: props.messageId,
    expirationTimestamp: msgProps?.expirationTimestamp,
    isExpired: msgProps?.isExpired,
  };
  const { isExpired } = useIsExpired(expiringProps);

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
  const {
    direction,
    conversationType,
    receivedAt,
    isUnread,
    expirationLength,
    expirationTimestamp,
  } = msgProps;

  if (isExpired) {
    return null;
  }

  const selected = isMessageSelected || false;
  const isGroup = conversationType === 'group';
  const isIncoming = direction === 'incoming';

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
      <MessageAvatar messageId={messageId} />
      {expirationLength && expirationTimestamp && (
        <ExpireTimer
          isCorrectSide={!isIncoming}
          expirationLength={expirationLength}
          expirationTimestamp={expirationTimestamp}
        />
      )}
      <MessageContentWithStatuses
        ctxMenuID={ctxMenuID}
        messageId={messageId}
        isDetailView={isDetailView}
        dataTestId={`message-content-${messageId}`}
        enableReactions={enableReactions}
      />
      {expirationLength && expirationTimestamp && (
        <ExpireTimer
          isCorrectSide={isIncoming}
          expirationLength={expirationLength}
          expirationTimestamp={expirationTimestamp}
        />
      )}
    </StyledReadableMessage>
  );
};
