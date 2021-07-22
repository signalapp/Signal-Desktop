import React from 'react';
import { useSelector } from 'react-redux';
import {
  PropsForDataExtractionNotification,
  QuoteClickOptions,
  MessageRegularProps,
} from '../../../models/messageType';
import {
  PropsForGroupUpdate,
  PropsForGroupInvitation,
  PropsForExpirationTimer,
  SortedMessageModelProps,
} from '../../../state/ducks/conversations';
import {
  getFirstUnreadMessageId,
  isMessageSelectionMode,
  getNextMessageToPlayIndex,
} from '../../../state/selectors/conversations';
import { DataExtractionNotification } from '../../conversation/DataExtractionNotification';
import { GroupInvitation } from '../../conversation/GroupInvitation';
import { GroupNotification } from '../../conversation/GroupNotification';
import { Message } from '../../conversation/Message';
import { TimerNotification } from '../../conversation/TimerNotification';
import { SessionLastSeenIndicator } from './SessionLastSeenIndicator';

export const UnreadIndicator = (props: { messageId: string }) => {
  const isFirstUnreadOnOpen = useSelector(getFirstUnreadMessageId);
  if (!isFirstUnreadOnOpen || isFirstUnreadOnOpen !== props.messageId) {
    return null;
  }
  return <SessionLastSeenIndicator key={`unread-indicator-${props.messageId}`} />;
};

export const GroupUpdateItem = (props: {
  messageId: string;
  groupNotificationProps: PropsForGroupUpdate;
}) => {
  return (
    <React.Fragment key={props.messageId}>
      <GroupNotification key={props.messageId} {...props.groupNotificationProps} />
      <UnreadIndicator messageId={props.messageId} />
    </React.Fragment>
  );
};

export const GroupInvitationItem = (props: {
  messageId: string;
  propsForGroupInvitation: PropsForGroupInvitation;
}) => {
  return (
    <React.Fragment key={props.messageId}>
      <GroupInvitation key={props.messageId} {...props.propsForGroupInvitation} />

      <UnreadIndicator messageId={props.messageId} />
    </React.Fragment>
  );
};

export const DataExtractionNotificationItem = (props: {
  messageId: string;
  propsForDataExtractionNotification: PropsForDataExtractionNotification;
}) => {
  return (
    <React.Fragment key={props.messageId}>
      <DataExtractionNotification
        key={props.messageId}
        {...props.propsForDataExtractionNotification}
      />

      <UnreadIndicator messageId={props.messageId} />
    </React.Fragment>
  );
};

export const TimerNotificationItem = (props: {
  messageId: string;
  timerProps: PropsForExpirationTimer;
}) => {
  return (
    <React.Fragment key={props.messageId}>
      <TimerNotification key={props.messageId} {...props.timerProps} />

      <UnreadIndicator messageId={props.messageId} />
    </React.Fragment>
  );
};

export const GenericMessageItem = (props: {
  messageId: string;
  messageProps: SortedMessageModelProps;
  playableMessageIndex?: number;
  scrollToQuoteMessage: (options: QuoteClickOptions) => Promise<void>;
  playNextMessage?: (value: number) => void;
}) => {
  const multiSelectMode = useSelector(isMessageSelectionMode);
  const nextMessageToPlay = useSelector(getNextMessageToPlayIndex);

  const messageId = props.messageId;

  const onQuoteClick = props.messageProps.propsForMessage.quote
    ? props.scrollToQuoteMessage
    : undefined;

  const regularProps: MessageRegularProps = {
    ...props.messageProps.propsForMessage,
    firstMessageOfSeries: props.messageProps.firstMessageOfSeries,
    multiSelectMode,
    nextMessageToPlay,
    playNextMessage: props.playNextMessage,
    onQuoteClick,
  };

  return (
    <React.Fragment key={props.messageId}>
      <Message
        {...regularProps}
        playableMessageIndex={props.playableMessageIndex}
        multiSelectMode={multiSelectMode}
        key={messageId}
      />
      <UnreadIndicator messageId={props.messageId} />
    </React.Fragment>
  );
};
