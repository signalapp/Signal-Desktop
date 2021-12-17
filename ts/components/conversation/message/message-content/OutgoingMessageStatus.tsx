import { ipcRenderer } from 'electron';
import React from 'react';
import styled from 'styled-components';
import { MessageDeliveryStatus } from '../../../../models/messageType';
import { SessionIcon } from '../../../icon';

const MessageStatusSendingContainer = styled.div`
  display: inline-block;
  align-self: flex-end;
  margin-bottom: 2px;
  margin-inline-start: 5px;
  cursor: pointer;
`;

const MessageStatusSending = () => {
  const iconColor = 'var(--color-text)';
  return (
    <MessageStatusSendingContainer>
      <SessionIcon rotateDuration={2} iconColor={iconColor} iconType="sending" iconSize="tiny" />
    </MessageStatusSendingContainer>
  );
};

const MessageStatusSent = () => {
  const iconColor = 'var(--color-text)';

  return (
    <MessageStatusSendingContainer>
      <SessionIcon iconColor={iconColor} iconType="circleCheck" iconSize="tiny" />
    </MessageStatusSendingContainer>
  );
};

const MessageStatusRead = () => {
  const iconColor = 'var(--color-text)';

  return (
    <MessageStatusSendingContainer>
      <SessionIcon iconColor={iconColor} iconType="doubleCheckCircleFilled" iconSize="tiny" />
    </MessageStatusSendingContainer>
  );
};

const MessageStatusError = () => {
  const showDebugLog = () => {
    ipcRenderer.send('show-debug-log');
  };

  return (
    <MessageStatusSendingContainer onClick={showDebugLog} title={window.i18n('sendFailed')}>
      <SessionIcon iconColor={'var(--color-destructive'} iconType="error" iconSize="tiny" />
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
