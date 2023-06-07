import classNames from 'classnames';
import { isEmpty } from 'lodash';
import React from 'react';
import { useSelector } from 'react-redux';
import {
  useConversationPropsById,
  useHasUnread,
  useIsPrivate,
  useIsTyping,
} from '../../../hooks/useParamSelector';
import { isSearching } from '../../../state/selectors/search';
import { getIsMessageRequestOverlayShown } from '../../../state/selectors/section';
import { TypingAnimation } from '../../conversation/TypingAnimation';
import { MessageBody } from '../../conversation/message/message-content/MessageBody';
import { OutgoingMessageStatus } from '../../conversation/message/message-content/OutgoingMessageStatus';
import { useConvoIdFromContext } from './ConvoIdContext';

function useLastMessageFromConvo(convoId: string) {
  const convoProps = useConversationPropsById(convoId);
  if (!convoProps) {
    return null;
  }
  return convoProps.lastMessage;
}

export const MessageItem = () => {
  const conversationId = useConvoIdFromContext();
  const lastMessage = useLastMessageFromConvo(conversationId);
  const isGroup = !useIsPrivate(conversationId);

  const hasUnread = useHasUnread(conversationId);
  const isConvoTyping = useIsTyping(conversationId);
  const isMessageRequest = useSelector(getIsMessageRequestOverlayShown);

  const isSearchingMode = useSelector(isSearching);

  if (!lastMessage && !isConvoTyping) {
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
          hasUnread ? 'module-conversation-list-item__message__text--has-unread' : null
        )}
      >
        {isConvoTyping ? (
          <TypingAnimation />
        ) : (
          <MessageBody text={text} disableJumbomoji={true} disableLinks={true} isGroup={isGroup} />
        )}
      </div>
      {!isSearchingMode && lastMessage && lastMessage.status && !isMessageRequest ? (
        <OutgoingMessageStatus status={lastMessage.status} />
      ) : null}
    </div>
  );
};
