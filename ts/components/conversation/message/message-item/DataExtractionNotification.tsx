import React from 'react';
import { PropsForDataExtractionNotification } from '../../../../models/messageType';
import { SignalService } from '../../../../protobuf';
import { Flex } from '../../../basic/Flex';
import { SpacerSM, Text } from '../../../basic/Text';
import { SessionIcon } from '../../../icon';
import { ReadableMessage } from './ReadableMessage';

export const DataExtractionNotification = (props: PropsForDataExtractionNotification) => {
  const { name, type, source, messageId, isUnread, receivedAt } = props;

  let contentText: string;
  if (type === SignalService.DataExtractionNotification.Type.MEDIA_SAVED) {
    contentText = window.i18n('savedTheFile', [name || source]);
  } else {
    contentText = window.i18n('tookAScreenshot', [name || source]);
  }

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
        <SessionIcon iconType="upload" iconSize="small" iconRotation={180} />
        <SpacerSM />
        <Text text={contentText} subtle={true} ellipsisOverflow={true} />
      </Flex>
    </ReadableMessage>
  );
};
