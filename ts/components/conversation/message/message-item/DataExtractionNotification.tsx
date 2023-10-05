import React from 'react';
import styled from 'styled-components';
import { PropsForDataExtractionNotification } from '../../../../models/messageType';
import { SignalService } from '../../../../protobuf';
import { Flex } from '../../../basic/Flex';
import { SpacerSM, Text } from '../../../basic/Text';
import { SessionIcon } from '../../../icon';
import { ExpirableReadableMessage } from './ExpirableReadableMessage';

const StyledDataExtractionNotificationContainer = styled.div`
  padding: 0 var(--margins-lg) 0;
`;

export const DataExtractionNotification = (props: PropsForDataExtractionNotification) => {
  const { name, type, source, messageId } = props;

  let contentText: string;
  if (type === SignalService.DataExtractionNotification.Type.MEDIA_SAVED) {
    contentText = window.i18n('savedTheFile', [name || source]);
  } else {
    contentText = window.i18n('tookAScreenshot', [name || source]);
  }

  return (
    <StyledDataExtractionNotificationContainer>
      <ExpirableReadableMessage
        messageId={messageId}
        key={`readable-message-${messageId}`}
        isCentered
      >
        <Flex
          container={true}
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          width="90%"
          maxWidth="700px"
          margin="10px auto"
          padding="5px 10px"
          id={`msg-${messageId}`}
          style={{ textAlign: 'center' }}
        >
          <SessionIcon iconType="save" iconColor="inherit" iconSize="large" />
          <SpacerSM />
          <Text text={contentText} ellipsisOverflow={true} />
        </Flex>
      </ExpirableReadableMessage>
    </StyledDataExtractionNotificationContainer>
  );
};
