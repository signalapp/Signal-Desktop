import React from 'react';
import { PropsForMessageRequestResponse } from '../../../../models/messageType';
import { getConversationController } from '../../../../session/conversations';
import { UserUtils } from '../../../../session/utils';
import { Flex } from '../../../basic/Flex';
import { SpacerSM, Text } from '../../../basic/Text';
import { ReadableMessage } from './ReadableMessage';

export const MessageRequestResponse = (props: PropsForMessageRequestResponse) => {
  const { messageId, isUnread, receivedAt, conversationId, source } = props;

  let profileName = '';
  if (conversationId) {
    profileName =
      getConversationController()
        .get(conversationId)
        .getProfileName() + '';
  }
  const msgText =
    profileName && props.source === UserUtils.getOurPubKeyStrFromCache()
      ? window.i18n('messageRequestAcceptedOurs', [profileName])
      : window.i18n('messageRequestAccepted');

  return (
    <ReadableMessage
      messageId={messageId}
      receivedAt={receivedAt}
      isUnread={isUnread}
      key={`readable-message-${messageId}`}
    >
      <Flex
        container={true}
        flexDirection="row"
        alignItems="center"
        justifyContent="center"
        margin={'var(--margins-sm)'}
        id={`msg-${messageId}`}
      >
        <SpacerSM />
        <Text text={msgText} subtle={true} ellipsisOverflow={true} />
      </Flex>
    </ReadableMessage>
  );
};
