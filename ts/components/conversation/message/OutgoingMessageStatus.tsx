import React from 'react';
import styled, { useTheme } from 'styled-components';
import { MessageDeliveryStatus } from '../../../models/messageType';
import { SessionIcon } from '../../session/icon';

const MessageStatusSendingContainer = styled.div`
  display: inline-block;
  margin-bottom: 2px;
  margin-inline-start: 5px;
`;

const MessageStatusSending = () => {
  const iconColor = useTheme().colors.textColor;
  return (
    <MessageStatusSendingContainer>
      <SessionIcon rotateDuration={2} iconColor={iconColor} iconType="sending" iconSize={'tiny'} />
    </MessageStatusSendingContainer>
  );
};

const MessageStatusSent = () => {
  const iconColor = useTheme().colors.textColor;

  return (
    <MessageStatusSendingContainer>
      <SessionIcon iconColor={iconColor} iconType="circleCheck" iconSize={'tiny'} />
    </MessageStatusSendingContainer>
  );
};

const MessageStatusRead = () => {
  const iconColor = useTheme().colors.textColor;

  return (
    <MessageStatusSendingContainer>
      <SessionIcon iconColor={iconColor} iconType="doubleCheckCircleFilled" iconSize={'tiny'} />
    </MessageStatusSendingContainer>
  );
};

const MessageStatusError = () => {
  const theme = useTheme();
  return (
    <MessageStatusSendingContainer title={window.i18n('sendFailed')}>
      <SessionIcon iconColor={theme.colors.destructive} iconType="error" iconSize={'tiny'} />
    </MessageStatusSendingContainer>
  );
};

export const OutgoingMessageStatus = (props: { status?: MessageDeliveryStatus | null }) => {
  switch (props.status) {
    case 'sending':
      return <MessageStatusSending />;
    case 'sent':
      return <MessageStatusSent />;
    case 'read':
      return <MessageStatusRead />;
    case 'error':
      return <MessageStatusError />;
    default:
      return null;
  }
};
