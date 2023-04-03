import React from 'react';
import { PropsForDataExtractionNotification } from '../../../../models/messageType';
import { SignalService } from '../../../../protobuf';
import { Flex } from '../../../basic/Flex';
import { SpacerSM, Text } from '../../../basic/Text';
import { SessionIcon } from '../../../icon';
import { ExpirableReadableMessage } from './ExpirableReadableMessage';

export const DataExtractionNotification = (props: PropsForDataExtractionNotification) => {
  const {
    name,
    type,
    source,
    messageId,
    isUnread,
    receivedAt,
    direction,
    expirationLength,
    expirationTimestamp,
    isExpired,
  } = props;

  let contentText: string;
  if (type === SignalService.DataExtractionNotification.Type.MEDIA_SAVED) {
    contentText = window.i18n('savedTheFile', [name || source]);
  } else {
    contentText = window.i18n('tookAScreenshot', [name || source]);
  }

  return (
    <ExpirableReadableMessage
      messageId={messageId}
      receivedAt={receivedAt}
      isUnread={isUnread}
      direction={direction}
      expirationLength={expirationLength}
      expirationTimestamp={expirationTimestamp}
      isExpired={isExpired}
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
    </ExpirableReadableMessage>
  );
};
