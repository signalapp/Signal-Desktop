import classNames from 'classnames';
import React, { useContext } from 'react';
import { isEmpty } from 'lodash';
import { useConversationPropsById, useIsPrivate } from '../../../hooks/useParamSelector';
import { MessageBody } from '../../conversation/message/message-content/MessageBody';
import { OutgoingMessageStatus } from '../../conversation/message/message-content/OutgoingMessageStatus';
import { TypingAnimation } from '../../conversation/TypingAnimation';
import { ContextConversationId } from './ConversationListItem';
import { useSelector } from 'react-redux';
import { isSearching } from '../../../state/selectors/search';

function useMessageItemProps(convoId: string) {
  const convoProps = useConversationPropsById(convoId);
  if (!convoProps) {
    return null;
  }
  return {
    isTyping: !!convoProps.isTyping,
    lastMessage: convoProps.lastMessage,
    unreadCount: convoProps.unreadCount || 0,
  };
}

export const MessageItem = (props: { isMessageRequest: boolean }) => {
  const conversationId = useContext(ContextConversationId);
  const convoProps = useMessageItemProps(conversationId);

  const isGroup = !!useIsPrivate(conversationId);

  const isSearchingMode = useSelector(isSearching);
  if (!convoProps) {
    return null;
  }
  const { lastMessage, isTyping, unreadCount } = convoProps;

  if (!lastMessage && !isTyping) {
    return null;
  }
  const text = lastMessage?.text || '';

  if (isEmpty(text)) {
    return null;
  }

  return (
    <div className="module-conversation-list-item__message">
      <div
        className={classNames(
          'module-conversation-list-item__message__text',
          unreadCount > 0 ? 'module-conversation-list-item__message__text--has-unread' : null
        )}
      >
        {isTyping ? (
          <TypingAnimation />
        ) : (
          <MessageBody text={text} disableJumbomoji={true} disableLinks={true} isGroup={isGroup} />
        )}
      </div>
      {!isSearchingMode && lastMessage && lastMessage.status && !props.isMessageRequest ? (
        <OutgoingMessageStatus status={lastMessage.status} />
      ) : null}
    </div>
  );
};
