import React, { useEffect, useState } from 'react';
import { isEmpty } from 'lodash';

import { useIsPrivate, useIsPublic } from '../../../hooks/useParamSelector';
import { MessageBody } from '../../conversation/message/message-content/MessageBody';
import { assertUnreachable } from '../../../types/sqlSharedTypes';
import {
  ConversationInteractionStatus,
  ConversationInteractionType,
} from '../../../interactions/conversationInteractions';
import styled from 'styled-components';
import { getConversationController } from '../../../session/conversations';
import { LastMessageType } from '../../../state/ducks/conversations';

const StyledInteractionItemText = styled.div<{ isError: boolean }>`
  ${props => props.isError && 'color: var(--danger-color) !important;'}
`;

type InteractionItemProps = {
  conversationId: string;
  lastMessage: LastMessageType | null;
};

export const InteractionItem = (props: InteractionItemProps) => {
  const { conversationId, lastMessage } = props;
  const isGroup = !useIsPrivate(conversationId);
  const isCommunity = useIsPublic(conversationId);

  if (!lastMessage) {
    return null;
  }

  const { interactionType, interactionStatus } = lastMessage;

  if (!interactionType || !interactionStatus) {
    return null;
  }

  const [storedLastMessageText, setStoredLastMessageText] = useState(lastMessage?.text);
  const [storedLastMessageInteractionStatus, setStoredLastMessageInteractionStatus] = useState(
    lastMessage?.interactionStatus
  );

  // NOTE we want to reset the interaction state when the last message changes
  useEffect(() => {
    if (conversationId) {
      const convo = getConversationController().get(conversationId);

      if (storedLastMessageInteractionStatus !== convo.get('lastMessageInteractionStatus')) {
        setStoredLastMessageInteractionStatus(convo.get('lastMessageInteractionStatus'));
        setStoredLastMessageText(convo.get('lastMessage'));
      }
    }
  }, [conversationId, interactionStatus, lastMessage?.interactionStatus]);

  let text = storedLastMessageText || '';
  let failText = '';
  switch (interactionType) {
    case ConversationInteractionType.Hide:
      failText = window.i18n('hideConversationFailed');
      text =
        interactionStatus === ConversationInteractionStatus.Error
          ? failText
          : interactionStatus === ConversationInteractionStatus.Loading
          ? window.i18n('hiding')
          : text;
      break;
    case ConversationInteractionType.Leave:
      failText = isCommunity
        ? window.i18n('leaveCommunityFailed')
        : isGroup
        ? window.i18n('leaveGroupFailed')
        : window.i18n('deleteConversationFailed');
      text =
        interactionStatus === ConversationInteractionStatus.Error
          ? failText
          : interactionStatus === ConversationInteractionStatus.Loading
          ? window.i18n('leaving')
          : text;
      break;
    default:
      assertUnreachable(
        interactionType,
        `InteractionItem: Missing case error "${interactionType}"`
      );
  }

  if (isEmpty(text)) {
    return null;
  }

  return (
    <div className="module-conversation-list-item__message">
      <StyledInteractionItemText
        className="module-conversation-list-item__message__text"
        isError={Boolean(interactionStatus === ConversationInteractionStatus.Error)}
      >
        <MessageBody text={text} disableJumbomoji={true} disableLinks={true} isGroup={isGroup} />
      </StyledInteractionItemText>
    </div>
  );
};
