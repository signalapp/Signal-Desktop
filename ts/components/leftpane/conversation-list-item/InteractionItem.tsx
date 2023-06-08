import React from 'react';
import { isEmpty } from 'lodash';

import { useIsPrivate, useIsPublic } from '../../../hooks/useParamSelector';
import { MessageBody } from '../../conversation/message/message-content/MessageBody';
import { assertUnreachable } from '../../../types/sqlSharedTypes';
import {
  ConversationInteractionStatus,
  ConversationInteractionType,
} from '../../../interactions/conversationInteractions';
import styled from 'styled-components';

const StyledInteractionItemText = styled.div<{ isError: boolean }>`
  ${props => props.isError && 'color: var(--danger-color) !important;'}
`;

export type InteractionItemProps = {
  conversationId?: string;
  interactionType?: ConversationInteractionType;
  interactionStatus?: ConversationInteractionStatus;
};

export const InteractionItem = (props: InteractionItemProps) => {
  const { conversationId, interactionStatus, interactionType } = props;
  const isGroup = !useIsPrivate(conversationId);
  const isCommunity = useIsPublic(conversationId);

  if (!conversationId || !interactionType) {
    return null;
  }

  let text = '';

  switch (interactionType) {
    case ConversationInteractionType.Leave:
      const failText = isCommunity
        ? ''
        : isGroup
        ? window.i18n('leaveGroupFailed')
        : window.i18n('deleteConversationFailed');

      text =
        interactionStatus === ConversationInteractionStatus.Error
          ? failText
          : interactionStatus === ConversationInteractionStatus.Loading
          ? window.i18n('leaving')
          : '';
      break;
    default:
      assertUnreachable(interactionType, `MessageItem: Missing case error "${interactionType}"`);
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
