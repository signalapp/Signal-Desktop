import { isEmpty } from 'lodash';
import styled from 'styled-components';
import { useIsPrivate, useIsPublic } from '../../../../hooks/useParamSelector';
import {
  ConversationInteractionStatus,
  ConversationInteractionType,
} from '../../../../interactions/conversationInteractions';
import { PropsForInteractionNotification } from '../../../../state/ducks/conversations';
import { assertUnreachable } from '../../../../types/sqlSharedTypes';
import { Flex } from '../../../basic/Flex';
import { ReadableMessage } from './ReadableMessage';

const StyledFailText = styled.div`
  color: var(--danger-color);
`;

export const InteractionNotification = (props: PropsForInteractionNotification) => {
  const { notificationType, convoId, messageId, receivedAt, isUnread } = props;

  const { interactionStatus, interactionType } = notificationType;

  const isGroup = !useIsPrivate(convoId);
  const isCommunity = useIsPublic(convoId);

  // NOTE at this time we don't show visible control messages in communities, that might change in future...
  if (isCommunity) {
    return null;
  }

  if (interactionStatus !== ConversationInteractionStatus.Error) {
    // NOTE For now we only show interaction errors in the message history
    return null;
  }

  let text = '';

  switch (interactionType) {
    case ConversationInteractionType.Hide:
      // this can't happen
      break;
    case ConversationInteractionType.Leave:
      text = isCommunity
        ? window.i18n('leaveCommunityFailedPleaseTryAgain')
        : isGroup
          ? window.i18n('leaveGroupFailedPleaseTryAgain')
          : window.i18n('deleteConversationFailedPleaseTryAgain');
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
      dataTestId="interaction-notification"
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
