import { useLayoutEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import useKey from 'react-use/lib/useKey';
import {
  PropsForDataExtractionNotification,
  PropsForMessageRequestResponse,
} from '../../models/messageType';
import {
  PropsForExpirationTimer,
  PropsForGroupInvitation,
  PropsForGroupUpdate,
} from '../../state/ducks/conversations';
import {
  getOldBottomMessageId,
  getOldTopMessageId,
  getSortedMessagesTypesOfSelectedConversation,
} from '../../state/selectors/conversations';
import { useSelectedConversationKey } from '../../state/selectors/selectedConversation';
import { MessageDateBreak } from './message/message-item/DateBreak';
import { GroupInvitation } from './message/message-item/GroupInvitation';
import { GroupUpdateMessage } from './message/message-item/GroupUpdateMessage';
import { Message } from './message/message-item/Message';
import { MessageRequestResponse } from './message/message-item/MessageRequestResponse';
import { CallNotification } from './message/message-item/notification-bubble/CallNotification';

import { IsDetailMessageViewContext } from '../../contexts/isDetailViewContext';
import { SessionLastSeenIndicator } from './SessionLastSeenIndicator';
import { TimerNotification } from './TimerNotification';
import { DataExtractionNotification } from './message/message-item/DataExtractionNotification';
import { InteractionNotification } from './message/message-item/InteractionNotification';
import { PropsForCallNotification, PropsForInteractionNotification } from '../../state/ducks/types';

function isNotTextboxEvent(e: KeyboardEvent) {
  return (e?.target as any)?.type === undefined;
}

let previousRenderedConvo: string | undefined;

export const SessionMessagesList = (props: {
  scrollAfterLoadMore: (
    messageIdToScrollTo: string,
    type: 'load-more-top' | 'load-more-bottom'
  ) => void;
  onPageUpPressed: () => void;
  onPageDownPressed: () => void;
  onHomePressed: () => void;
  onEndPressed: () => void;
}) => {
  const messagesProps = useSelector(getSortedMessagesTypesOfSelectedConversation);
  const convoKey = useSelectedConversationKey();

  const [didScroll, setDidScroll] = useState(false);
  const oldTopMessageId = useSelector(getOldTopMessageId);
  const oldBottomMessageId = useSelector(getOldBottomMessageId);

  useLayoutEffect(() => {
    const newTopMessageId = messagesProps.length
      ? messagesProps[messagesProps.length - 1].message.props.messageId
      : undefined;

    if (oldTopMessageId !== newTopMessageId && oldTopMessageId && newTopMessageId) {
      props.scrollAfterLoadMore(oldTopMessageId, 'load-more-top');
    }

    const newBottomMessageId = messagesProps.length
      ? messagesProps[0].message.props.messageId
      : undefined;

    if (newBottomMessageId !== oldBottomMessageId && oldBottomMessageId && newBottomMessageId) {
      props.scrollAfterLoadMore(oldBottomMessageId, 'load-more-bottom');
    }
  });

  useKey('PageUp', () => {
    props.onPageUpPressed();
  });

  useKey('PageDown', () => {
    props.onPageDownPressed();
  });

  useKey('Home', e => {
    if (isNotTextboxEvent(e)) {
      props.onHomePressed();
    }
  });

  useKey('End', e => {
    if (isNotTextboxEvent(e)) {
      props.onEndPressed();
    }
  });

  if (didScroll && previousRenderedConvo !== convoKey) {
    setDidScroll(false);
    previousRenderedConvo = convoKey;
  }

  return (
    <IsDetailMessageViewContext.Provider value={false}>
      {messagesProps.map(messageProps => {
        const messageId = messageProps.message.props.messageId;
        const unreadIndicator = messageProps.showUnreadIndicator ? (
          <SessionLastSeenIndicator
            key={'unread-indicator'}
            messageId={messageId}
            didScroll={didScroll}
            setDidScroll={setDidScroll}
          />
        ) : null;

        const dateBreak =
          messageProps.showDateBreak !== undefined ? (
            <MessageDateBreak
              key={`date-break-${messageId}`}
              timestamp={messageProps.showDateBreak}
              messageId={messageId}
            />
          ) : null;

        const componentToMerge = [dateBreak, unreadIndicator];

        if (messageProps.message?.messageType === 'group-notification') {
          const msgProps = messageProps.message.props as PropsForGroupUpdate;
          return [<GroupUpdateMessage key={messageId} {...msgProps} />, ...componentToMerge];
        }

        if (messageProps.message?.messageType === 'group-invitation') {
          const msgProps = messageProps.message.props as PropsForGroupInvitation;
          return [<GroupInvitation key={messageId} {...msgProps} />, ...componentToMerge];
        }

        if (messageProps.message?.messageType === 'message-request-response') {
          const msgProps = messageProps.message.props as PropsForMessageRequestResponse;

          return [<MessageRequestResponse key={messageId} {...msgProps} />, ...componentToMerge];
        }

        if (messageProps.message?.messageType === 'data-extraction') {
          const msgProps = messageProps.message.props as PropsForDataExtractionNotification;

          return [
            <DataExtractionNotification key={messageId} {...msgProps} />,
            ...componentToMerge,
          ];
        }

        if (messageProps.message?.messageType === 'timer-notification') {
          const msgProps = messageProps.message.props as PropsForExpirationTimer;

          return [<TimerNotification key={messageId} {...msgProps} />, ...componentToMerge];
        }

        if (messageProps.message?.messageType === 'call-notification') {
          const msgProps = messageProps.message.props as PropsForCallNotification;

          return [<CallNotification key={messageId} {...msgProps} />, ...componentToMerge];
        }

        if (messageProps.message?.messageType === 'interaction-notification') {
          const msgProps = messageProps.message.props as PropsForInteractionNotification;

          return [<InteractionNotification key={messageId} {...msgProps} />, ...componentToMerge];
        }

        if (!messageProps) {
          return null;
        }

        return [<Message messageId={messageId} key={messageId} />, ...componentToMerge];
      })}
    </IsDetailMessageViewContext.Provider>
  );
};
