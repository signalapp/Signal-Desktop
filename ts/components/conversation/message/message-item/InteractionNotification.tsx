import React from 'react';

import { useIsPrivate, useIsPublic } from '../../../../hooks/useParamSelector';
import {
  ConversationInteractionStatus,
  ConversationInteractionType,
} from '../../../../interactions/conversationInteractions';
import styled from 'styled-components';
import { assertUnreachable } from '../../../../types/sqlSharedTypes';
import { isEmpty } from 'lodash';
import { Flex } from '../../../basic/Flex';
import { PropsForInteractionNotification } from '../../../../state/ducks/conversations';
import { ReadableMessage } from './ReadableMessage';

const StyledFailText = styled.div`
  color: var(--danger-color);
`;

export const InteractionNotification = (props: PropsForInteractionNotification) => {
  const { notificationType, convoId, messageId, receivedAt, isUnread } = props;

  const { interactionStatus, interactionType } = notificationType;

  const isGroup = !useIsPrivate(convoId);
  const isCommunity = useIsPublic(convoId);

  // NOTE For now we only show interaction errors in the message history
  if (interactionStatus !== ConversationInteractionStatus.Error) {
    return null;
  }

  let text = '';

  switch (interactionType) {
    case ConversationInteractionType.Hide:
      text = window.i18n('hideConversationFailed');
      break;
    case ConversationInteractionType.Leave:
      text = isCommunity
        ? window.i18n('leaveCommunityFailed')
        : isGroup
        ? window.i18n('leaveGroupFailed')
        : window.i18n('deleteConversationFailed');
      break;
    default:
      assertUnreachable(
        interactionType,
        `InteractionErrorMessage: Missing case error "${interactionType}"`
      );
  }

  if (isEmpty(text)) {
    return null;
  }

  return (
    <ReadableMessage
      messageId={messageId}
      receivedAt={receivedAt}
      isUnread={isUnread}
      key={`readable-message-${messageId}`}
    >
      <Flex
        id={`convo-interaction-${convoId}`}
        container={true}
        flexDirection="row"
        alignItems="center"
        justifyContent="center"
        margin={'var(--margins-md) var(--margins-sm)'}
        data-testid="control-message"
      >
        <StyledFailText>{text}</StyledFailText>
      </Flex>
    </ReadableMessage>
  );
};
