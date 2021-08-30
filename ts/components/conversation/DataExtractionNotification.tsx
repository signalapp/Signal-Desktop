import React from 'react';
import { useTheme } from 'styled-components';
import { PropsForDataExtractionNotification } from '../../models/messageType';
import { SignalService } from '../../protobuf';
import { Flex } from '../basic/Flex';
import { SessionIcon, SessionIconType } from '../session/icon';
import { SpacerXS, Text } from '../basic/Text';
import { ReadableMessage } from './ReadableMessage';

export const DataExtractionNotification = (props: PropsForDataExtractionNotification) => {
  const theme = useTheme();
  const { name, type, source, messageId, isUnread, receivedAt } = props;

  let contentText: string;
  if (type === SignalService.DataExtractionNotification.Type.MEDIA_SAVED) {
    contentText = window.i18n('savedTheFile', name || source);
  } else {
    contentText = window.i18n('tookAScreenshot', name || source);
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
        flexDirection="column"
        alignItems="center"
        margin={theme.common.margins.sm}
        id={`msg-${messageId}`}
      >
        <SessionIcon
          iconType={SessionIconType.Upload}
          theme={theme}
          iconSize={'small'}
          iconRotation={180}
        />
        <SpacerXS />
        <Text text={contentText} subtle={true} />
      </Flex>
    </ReadableMessage>
  );
};
