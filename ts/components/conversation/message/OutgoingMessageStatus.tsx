import React from 'react';
import styled, { DefaultTheme } from 'styled-components';
import {
  SessionIcon,
  SessionIconSize,
  SessionIconType,
} from '../../session/icon';

const MessageStatusSendingContainer = styled.div`
  min-width: 12px;
  min-height: 12px;
  width: 12px;
  height: 12px;
  display: inline-block;
  margin-bottom: 2px;
  margin-inline-start: 5px;
`;

const MessageStatusSending = (props: {
  theme: DefaultTheme;
  withImageNoCaption: boolean;
}) => {
  const iconColor = props.withImageNoCaption ? 'white' : undefined;
  return (
    <MessageStatusSendingContainer>
      <SessionIcon
        rotateDuration={2}
        iconColor={iconColor}
        theme={props.theme}
        iconType={SessionIconType.Sending}
        iconSize={SessionIconSize.Tiny}
      />
    </MessageStatusSendingContainer>
  );
};

const MessageStatusSent = (props: {
  theme: DefaultTheme;
  withImageNoCaption: boolean;
}) => {
  const iconColor = props.withImageNoCaption ? 'white' : undefined;

  return (
    <MessageStatusSendingContainer>
      <SessionIcon
        iconColor={iconColor}
        theme={props.theme}
        iconType={SessionIconType.CircleCheck}
        iconSize={SessionIconSize.Small}
      />
    </MessageStatusSendingContainer>
  );
};

const MessageStatusDelivered = (props: {
  theme: DefaultTheme;
  withImageNoCaption: boolean;
}) => {
  const iconColor = props.withImageNoCaption ? 'white' : undefined;
  return (
    <MessageStatusSendingContainer>
      <SessionIcon
        iconColor={iconColor}
        theme={props.theme}
        iconType={SessionIconType.DoubleCheck}
        iconSize={SessionIconSize.Small}
      />
    </MessageStatusSendingContainer>
  );
};

const MessageStatusRead = (props: {
  theme: DefaultTheme;
  withImageNoCaption: boolean;
}) => {
  const iconColor = props.withImageNoCaption ? 'white' : undefined;

  return (
    <MessageStatusSendingContainer>
      <SessionIcon
        iconColor={iconColor}
        theme={props.theme}
        iconType={SessionIconType.Read}
        iconSize={SessionIconSize.Small}
      />
    </MessageStatusSendingContainer>
  );
};

const MessageStatusError = (props: {
  theme: DefaultTheme;
  withImageNoCaption: boolean;
}) => {
  return (
    <MessageStatusSendingContainer>
      <SessionIcon
        iconColor={props.theme.colors.destructive}
        theme={props.theme}
        iconType={SessionIconType.Error}
        iconSize={SessionIconSize.Small}
      />
    </MessageStatusSendingContainer>
  );
};

export const OutgoingMessageStatus = (props: {
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'error' | 'pow';
  theme: DefaultTheme;
  withImageNoCaption: boolean;
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
      return <MessageStatusError {...props} />;
    default:
      return null;
  }
};
