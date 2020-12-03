import React from 'react';
import styled, { DefaultTheme } from 'styled-components';
import {
  SessionIcon,
  SessionIconSize,
  SessionIconType,
} from '../../session/icon';

const MessageStatusSendingContainer = styled.div`
  display: inline-block;
  margin-bottom: 2px;
  margin-inline-start: 5px;
`;

const MessageStatusSending = (props: {
  theme: DefaultTheme;
  iconColor: string;
}) => {
  return (
    <MessageStatusSendingContainer>
      <SessionIcon
        rotateDuration={2}
        iconColor={props.iconColor}
        theme={props.theme}
        iconType={SessionIconType.Sending}
        iconSize={SessionIconSize.Tiny}
      />
    </MessageStatusSendingContainer>
  );
};

const MessageStatusSent = (props: {
  theme: DefaultTheme;
  iconColor: string;
}) => {
  return (
    <MessageStatusSendingContainer>
      <SessionIcon
        iconColor={props.iconColor}
        theme={props.theme}
        iconType={SessionIconType.CircleCheck}
        iconSize={SessionIconSize.Tiny}
      />
    </MessageStatusSendingContainer>
  );
};

const MessageStatusDelivered = (props: {
  theme: DefaultTheme;
  iconColor: string;
}) => {
  return (
    <MessageStatusSendingContainer>
      <SessionIcon
        iconColor={props.iconColor}
        theme={props.theme}
        iconType={SessionIconType.DoubleCheckCircle}
        iconSize={SessionIconSize.Tiny}
      />
    </MessageStatusSendingContainer>
  );
};

const MessageStatusRead = (props: {
  theme: DefaultTheme;
  iconColor: string;
}) => {
  return (
    <MessageStatusSendingContainer>
      <SessionIcon
        iconColor={props.iconColor}
        theme={props.theme}
        iconType={SessionIconType.DoubleCheckCircleFilled}
        iconSize={SessionIconSize.Tiny}
      />
    </MessageStatusSendingContainer>
  );
};

const MessageStatusError = (props: { theme: DefaultTheme }) => {
  return (
    <MessageStatusSendingContainer>
      <SessionIcon
        iconColor={props.theme.colors.destructive}
        theme={props.theme}
        iconType={SessionIconType.Error}
        iconSize={SessionIconSize.Tiny}
      />
    </MessageStatusSendingContainer>
  );
};

export const OutgoingMessageStatus = (props: {
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'error' | 'pow';
  theme: DefaultTheme;
  iconColor: string;
  hideErrors?: boolean;
}) => {
  switch (props.status) {
    case 'pow':
    case 'sending':
      return <MessageStatusSending {...props} />;
    case 'sent':
      return <MessageStatusSent {...props} />;
    case 'delivered':
      return <MessageStatusDelivered {...props} />;
    case 'read':
      return <MessageStatusRead {...props} />;
    case 'error':
      if (props.hideErrors) {
        return null;
      }
      return <MessageStatusError {...props} />;
    default:
      return null;
  }
};
