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

export const GroupUpdateItem = (props: { groupNotificationProps: PropsForGroupUpdate }) => {
  return (
    <React.Fragment key={props.groupNotificationProps.messageId}>
      <GroupNotification
        key={props.groupNotificationProps.messageId}
        {...props.groupNotificationProps}
      />
      <UnreadIndicator messageId={props.groupNotificationProps.messageId} />
    </React.Fragment>
  );
};

export const GroupInvitationItem = (props: {
  propsForGroupInvitation: PropsForGroupInvitation;
}) => {
  return (
    <React.Fragment key={props.propsForGroupInvitation.messageId}>
      <GroupInvitation
        key={props.propsForGroupInvitation.messageId}
        {...props.propsForGroupInvitation}
      />

      <UnreadIndicator messageId={props.propsForGroupInvitation.messageId} />
    </React.Fragment>
  );
};

export const DataExtractionNotificationItem = (props: {
  propsForDataExtractionNotification: PropsForDataExtractionNotification;
}) => {
  return (
    <React.Fragment key={props.propsForDataExtractionNotification.messageId}>
      <DataExtractionNotification
        key={props.propsForDataExtractionNotification.messageId}
        {...props.propsForDataExtractionNotification}
      />

      <UnreadIndicator messageId={props.propsForDataExtractionNotification.messageId} />
    </React.Fragment>
  );
};

export const TimerNotificationItem = (props: { timerProps: PropsForExpirationTimer }) => {
  return (
    <React.Fragment key={props.timerProps.messageId}>
      <TimerNotification key={props.timerProps.messageId} {...props.timerProps} />

      <UnreadIndicator messageId={props.timerProps.messageId} />
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
