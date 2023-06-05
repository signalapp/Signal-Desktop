import classNames from 'classnames';
import { isEmpty } from 'lodash';
import React from 'react';
import { useSelector } from 'react-redux';
import {
  useConfirmModalStatusAndType,
  useConversationPropsById,
  useHasUnread,
  useIsPrivate,
  useIsPublic,
  useIsTyping,
} from '../../../hooks/useParamSelector';
import { isSearching } from '../../../state/selectors/search';
import { getIsMessageRequestOverlayShown } from '../../../state/selectors/section';
import { TypingAnimation } from '../../conversation/TypingAnimation';
import { MessageBody } from '../../conversation/message/message-content/MessageBody';
import { OutgoingMessageStatus } from '../../conversation/message/message-content/OutgoingMessageStatus';
import { useConvoIdFromContext } from './ConvoIdContext';
import { assertUnreachable } from '../../../types/sqlSharedTypes';

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
  const isCommunity = useIsPublic(conversationId);

  const hasUnread = useHasUnread(conversationId);
  const isConvoTyping = useIsTyping(conversationId);
  const isMessageRequest = useSelector(getIsMessageRequestOverlayShown);

  const isSearchingMode = useSelector(isSearching);

  const confirmModal = useConfirmModalStatusAndType();

  if (!lastMessage && !isConvoTyping) {
    return null;
  }

  let text = lastMessage?.text || '';
  if (confirmModal?.conversationId === conversationId && confirmModal?.type) {
    window.log.debug(`WIP: updating status for ${confirmModal?.type} ${confirmModal.status}`);
    switch (confirmModal?.type) {
      case 'delete-conversation':
        const failText = isCommunity
          ? ''
          : isGroup
          ? window.i18n('leaveGroupFailed')
          : window.i18n('deleteConversationFailed');

        text =
          confirmModal.status === 'error'
            ? failText
            : confirmModal.status === 'loading'
            ? window.i18n('leaving')
            : '';
        break;
      default:
        assertUnreachable(
          confirmModal?.type,
          `MessageItem: Missing case error "${confirmModal?.type}"`
        );
    }
  }

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
