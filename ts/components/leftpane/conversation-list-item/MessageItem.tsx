import classNames from 'classnames';
import { isEmpty } from 'lodash';
import React from 'react';
import { useSelector } from 'react-redux';
import { useConvoIdFromContext } from '../../../contexts/ConvoIdContext';
import {
  useHasUnread,
  useIsPrivate,
  useIsTyping,
  useLastMessage,
} from '../../../hooks/useParamSelector';
import { LastMessageStatusType } from '../../../state/ducks/conversations';
import { isSearching } from '../../../state/selectors/search';
import { getIsMessageRequestOverlayShown } from '../../../state/selectors/section';
import { assertUnreachable } from '../../../types/sqlSharedTypes';
import { TypingAnimation } from '../../conversation/TypingAnimation';
import { MessageBody } from '../../conversation/message/message-content/MessageBody';
import { SessionIcon } from '../../icon';
import { InteractionItem } from './InteractionItem';

export const MessageItem = () => {
  const conversationId = useConvoIdFromContext();
  const lastMessage = useLastMessage(conversationId);
  const isGroup = !useIsPrivate(conversationId);

  const hasUnread = useHasUnread(conversationId);
  const isConvoTyping = useIsTyping(conversationId);
  const isMessageRequest = useSelector(getIsMessageRequestOverlayShown);

  const isSearchingMode = useSelector(isSearching);

  if (lastMessage?.interactionType && lastMessage?.interactionStatus) {
    return <InteractionItem conversationId={conversationId} lastMessage={lastMessage} />;
  }

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
        <IconMessageStatus status={lastMessage.status} />
      ) : null}
    </div>
  );
};

function IconMessageStatus({ status }: { status: LastMessageStatusType }) {
  const nonErrorIconColor = 'var(--text-secondary-color';
  switch (status) {
    case 'error':
      return (
        <SessionIcon
          iconColor={'var(--danger-color'}
          iconType="error"
          iconSize="tiny"
          style={{ flexShrink: 0 }}
        />
      );
    case 'read':
      return (
        <SessionIcon
          iconColor={nonErrorIconColor}
          iconType="doubleCheckCircleFilled"
          iconSize="tiny"
          style={{ flexShrink: 0 }}
        />
      );
    case 'sending':
      return (
        <SessionIcon
          rotateDuration={2}
          iconColor={nonErrorIconColor}
          iconType="sending"
          iconSize="tiny"
          style={{ flexShrink: 0 }}
        />
      );
    case 'sent':
      return (
        <SessionIcon
          iconColor={nonErrorIconColor}
          iconType="circleCheck"
          iconSize="tiny"
          style={{ flexShrink: 0 }}
        />
      );
    case undefined:
      return null;
    default:
      assertUnreachable(status, 'missing case error');
  }
}
