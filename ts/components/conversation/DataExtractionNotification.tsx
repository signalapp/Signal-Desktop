import React from 'react';
import { useTheme } from 'styled-components';
import { PropsForDataExtractionNotification } from '../../models/messageType';
import { SignalService } from '../../protobuf';
import { Flex } from '../basic/Flex';
import { SessionIcon, SessionIconSize, SessionIconType } from '../session/icon';
import { SpacerXS, Text } from '../basic/Text';

export const DataExtractionNotification = (props: PropsForDataExtractionNotification) => {
  const theme = useTheme();
  const { name, type, source, messageId } = props;

  let contentText: string;
  if (type === SignalService.DataExtractionNotification.Type.MEDIA_SAVED) {
    contentText = window.i18n('savedTheFile', name || source);
  } else {
    contentText = window.i18n('tookAScreenshot', name || source);
  }

  return (
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
        iconSize={SessionIconSize.Small}
        iconRotation={180}
      />
      <SpacerXS />
      <Text text={contentText} subtle={true} />
    </Flex>
  );
};
