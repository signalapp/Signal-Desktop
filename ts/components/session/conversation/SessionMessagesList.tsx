import React from 'react';
import { useSelector } from 'react-redux';
import { QuoteClickOptions } from '../../../models/messageType';
import { SortedMessageModelProps } from '../../../state/ducks/conversations';
import { getSortedMessagesOfSelectedConversation } from '../../../state/selectors/conversations';
import {
  GroupUpdateItem,
  GroupInvitationItem,
  DataExtractionNotificationItem,
  TimerNotificationItem,
  GenericMessageItem,
} from './SessionMessagesTypes';

export const SessionMessagesList = (props: {
  scrollToQuoteMessage: (options: QuoteClickOptions) => Promise<void>;
  playNextMessage?: (value: number) => void;
}) => {
  const messagesProps = useSelector(getSortedMessagesOfSelectedConversation);
  let playableMessageIndex = 0;

  return (
    <>
      {messagesProps.map((messageProps: SortedMessageModelProps, index: number) => {
        const timerProps = messageProps.propsForTimerNotification;
        const propsForGroupInvitation = messageProps.propsForGroupInvitation;
        const propsForDataExtractionNotification = messageProps.propsForDataExtractionNotification;

        const groupNotificationProps = messageProps.propsForGroupNotification;

        if (groupNotificationProps) {
          return (
            <GroupUpdateItem
              key={messageProps.propsForMessage.id}
              groupNotificationProps={groupNotificationProps}
            />
          );
        }

        if (propsForGroupInvitation) {
          return (
            <GroupInvitationItem
              key={messageProps.propsForMessage.id}
              propsForGroupInvitation={propsForGroupInvitation}
            />
          );
        }

        if (propsForDataExtractionNotification) {
          return (
            <DataExtractionNotificationItem
              key={messageProps.propsForMessage.id}
              propsForDataExtractionNotification={propsForDataExtractionNotification}
            />
          );
        }

        if (timerProps) {
          return (
            <TimerNotificationItem key={messageProps.propsForMessage.id} timerProps={timerProps} />
          );
        }

        if (!messageProps) {
          return;
        }

        playableMessageIndex++;

        // firstMessageOfSeries tells us to render the avatar only for the first message
        // in a series of messages from the same user
        return (
          <GenericMessageItem
            key={messageProps.propsForMessage.id}
            playableMessageIndex={playableMessageIndex}
            messageId={messageProps.propsForMessage.id}
            messageProps={messageProps}
            scrollToQuoteMessage={props.scrollToQuoteMessage}
            playNextMessage={props.playNextMessage}
          />
        );
      })}
    </>
  );
};
