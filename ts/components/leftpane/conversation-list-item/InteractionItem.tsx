import React from 'react';
import { isEmpty } from 'lodash';

import { useIsPrivate, useIsPublic } from '../../../hooks/useParamSelector';
import { MessageBody } from '../../conversation/message/message-content/MessageBody';
import { assertUnreachable } from '../../../types/sqlSharedTypes';
import { ConfirmationStatus } from '../../dialog/SessionConfirm';
import {
  ConversationInteractionStatus,
  ConversationInteractionType,
} from '../../../interactions/conversationInteractions';

type InteractionItemProps = {
  status: ConfirmationStatus | undefined;
  type: ConversationInteractionType | undefined;
  conversationId: string | undefined;
};

export const InteractionItem = (props: InteractionItemProps) => {
  const { status, type, conversationId } = props;
  const isGroup = !useIsPrivate(conversationId);
  const isCommunity = useIsPublic(conversationId);

  if (!type) {
    return null;
  }

  let text = '';
  window.log.debug(`WIP: InteractionItem updating status for ${type} ${status}`);
  switch (type) {
    case ConversationInteractionType.Leave:
      const failText = isCommunity
        ? ''
        : isGroup
        ? window.i18n('leaveGroupFailed')
        : window.i18n('deleteConversationFailed');

      text =
        status === ConversationInteractionStatus.Error
          ? failText
          : status === ConversationInteractionStatus.Loading
          ? window.i18n('leaving')
          : '';
      break;
    default:
      assertUnreachable(type, `MessageItem: Missing case error "${type}"`);
  }

  if (isEmpty(text)) {
    return null;
  }

  return (
    <div className="module-conversation-list-item__message">
      <div className="module-conversation-list-item__message__text">
        <MessageBody text={text} disableJumbomoji={true} disableLinks={true} isGroup={isGroup} />
      </div>
    </div>
  );
};
