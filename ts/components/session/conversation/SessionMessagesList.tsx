import React from 'react';
import { useSelector } from 'react-redux';
import { QuoteClickOptions } from '../../../models/messageType';
import { getSortedMessagesTypesOfSelectedConversation } from '../../../state/selectors/conversations';
import {
  DataExtractionNotificationItem,
  GenericMessageItem,
  GroupInvitationItem,
  GroupUpdateItem,
  TimerNotificationItem,
} from './SessionMessagesTypes';

export const SessionMessagesList = (props: {
  scrollToQuoteMessage: (options: QuoteClickOptions) => Promise<void>;
}) => {
  const messagesProps = useSelector(getSortedMessagesTypesOfSelectedConversation);

  return (
    <>
      {messagesProps.map(messageProps => {
        if (messageProps.messageType === 'group-notification') {
          return (
            <GroupUpdateItem
              key={messageProps.props.messageId}
              groupNotificationProps={messageProps.props}
            />
          );
        }

        if (messageProps.messageType === 'group-invitation') {
          return (
            <GroupInvitationItem
              key={messageProps.props.messageId}
              propsForGroupInvitation={messageProps.props}
            />
          );
        }

        if (messageProps.messageType === 'data-extraction') {
          return (
            <DataExtractionNotificationItem
              key={messageProps.props.messageId}
              propsForDataExtractionNotification={messageProps.props}
            />
          );
        }

        if (messageProps.messageType === 'timer-notification') {
          return (
            <TimerNotificationItem
              key={messageProps.props.messageId}
              timerProps={messageProps.props}
            />
          );
        }

        if (!messageProps) {
          return null;
        }

        // firstMessageOfSeries tells us to render the avatar only for the first message
        // in a series of messages from the same user
        return (
          <GenericMessageItem
            key={messageProps.props.messageId}
            messageId={messageProps.props.messageId}
            scrollToQuoteMessage={props.scrollToQuoteMessage}
          />
        );
      })}
    </>
  );
};
