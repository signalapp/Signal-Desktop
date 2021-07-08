import React from 'react';
import styled, { DefaultTheme, useTheme } from 'styled-components';
import { MessageDeliveryStatus } from '../../../models/messageType';
import { SessionIcon, SessionIconSize, SessionIconType } from '../../session/icon';
import { OpacityMetadataComponent } from './MessageMetadata';

const MessageStatusSendingContainer = styled(props => <OpacityMetadataComponent {...props} />)`
  display: inline-block;
  margin-bottom: 2px;
  margin-inline-start: 5px;
`;

const MessageStatusSending = (props: { iconColor: string }) => {
  return (
    <MessageStatusSendingContainer>
      <SessionIcon
        rotateDuration={2}
        iconColor={props.iconColor}
        iconType={SessionIconType.Sending}
        iconSize={SessionIconSize.Tiny}
      />
    </MessageStatusSendingContainer>
  );
};

const MessageStatusSent = (props: { iconColor: string }) => {
  return (
    <MessageStatusSendingContainer>
      <SessionIcon
        iconColor={props.iconColor}
        iconType={SessionIconType.CircleCheck}
        iconSize={SessionIconSize.Tiny}
      />
    </MessageStatusSendingContainer>
  );
};

const MessageStatusRead = (props: { iconColor: string }) => {
  return (
    <MessageStatusSendingContainer>
      <SessionIcon
        iconColor={props.iconColor}
        iconType={SessionIconType.DoubleCheckCircleFilled}
        iconSize={SessionIconSize.Tiny}
      />
    </MessageStatusSendingContainer>
  );
};

const MessageStatusError = () => {
  const theme = useTheme();
  return (
    <MessageStatusSendingContainer>
      <SessionIcon
        iconColor={theme.colors.destructive}
        iconType={SessionIconType.Error}
        iconSize={SessionIconSize.Tiny}
      />
    </MessageStatusSendingContainer>
  );
};

export const OutgoingMessageStatus = (props: {
  status?: MessageDeliveryStatus | null;
  iconColor: string;
  isInMessageView?: boolean;
}) => {
  switch (props.status) {
    case 'sending':
      return <MessageStatusSending {...props} />;
    case 'sent':
      return <MessageStatusSent {...props} />;
    case 'read':
      return <MessageStatusRead {...props} />;
    case 'error':
      if (props.isInMessageView) {
        return null;
      }
      return <MessageStatusError />;
    default:
      return null;
  }
};
