import React, { useEffect, useState } from 'react';
import { isEmpty } from 'lodash';

import { useIsPrivate, useIsPublic } from '../../../hooks/useParamSelector';
import { MessageBody } from '../../conversation/message/message-content/MessageBody';
import { assertUnreachable } from '../../../types/sqlSharedTypes';
import {
  ConversationInteractionProps,
  ConversationInteractionStatus,
  ConversationInteractionType,
  clearConversationInteractionState,
} from '../../../interactions/conversationInteractions';
import styled from 'styled-components';
import { getConversationController } from '../../../session/conversations';
import { LastMessageType } from '../../../state/ducks/conversations';

const StyledInteractionItemText = styled.div<{ isError: boolean }>`
  ${props => props.isError && 'color: var(--danger-color) !important;'}
`;

type InteractionItemProps = ConversationInteractionProps & {
  lastMessage?: LastMessageType | null;
};

export const InteractionItem = (props: InteractionItemProps) => {
  const { conversationId, interactionStatus, interactionType, lastMessage } = props;
  const isGroup = !useIsPrivate(conversationId);
  const isCommunity = useIsPublic(conversationId);

  const [storedLastMessage, setStoredLastMessage] = useState(lastMessage?.text);

  // NOTE we want to reset the interaction state when the last message changes
  useEffect(() => {
    if (conversationId) {
      const convo = getConversationController().get(conversationId);

      window.log.debug(
        `WIP: storedLastMessage "${storedLastMessage}" convo.get('lastMessage') "${convo.get(
          'lastMessage'
        )}'`
      );

      if (storedLastMessage !== convo.get('lastMessage')) {
        setStoredLastMessage(convo.get('lastMessage'));
        void clearConversationInteractionState({ conversationId });
      }
    }
  }, [conversationId, interactionStatus, lastMessage?.text]);

  if (isEmpty(conversationId) || isEmpty(interactionType) || isEmpty(interactionStatus)) {
    return null;
  }

  let text = storedLastMessage || '';
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
          : text;
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
