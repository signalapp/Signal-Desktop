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

const MessageStatusSending = ({ dataTestId }: { dataTestId?: string }) => {
  const iconColor = 'var(--color-text)';
  return (
    <MessageStatusSendingContainer data-testid={dataTestId} data-testtype="sending">
      <SessionIcon rotateDuration={2} iconColor={iconColor} iconType="sending" iconSize="tiny" />
    </MessageStatusSendingContainer>
  );
};

const MessageStatusSent = ({ dataTestId }: { dataTestId?: string }) => {
  const iconColor = 'var(--color-text)';

  return (
    <MessageStatusSendingContainer data-testid={dataTestId} data-testtype="sent">
      <SessionIcon iconColor={iconColor} iconType="circleCheck" iconSize="tiny" />
    </MessageStatusSendingContainer>
  );
};

const MessageStatusRead = ({ dataTestId }: { dataTestId?: string }) => {
  const iconColor = 'var(--color-text)';

  return (
    <MessageStatusSendingContainer data-testid={dataTestId} data-testtype="read">
      <SessionIcon iconColor={iconColor} iconType="doubleCheckCircleFilled" iconSize="tiny" />
    </MessageStatusSendingContainer>
  );
};

const MessageStatusError = ({ dataTestId }: { dataTestId?: string }) => {
  const showDebugLog = () => {
    ipcRenderer.send('show-debug-log');
  };

  return (
    <MessageStatusSendingContainer
      data-testid={dataTestId}
      data-testtype="failed"
      onClick={showDebugLog}
      title={window.i18n('sendFailed')}
    >
      <SessionIcon iconColor={'var(--color-destructive'} iconType="error" iconSize="tiny" />
    </MessageStatusSendingContainer>
  );
};

export const OutgoingMessageStatus = (props: {
  status?: MessageDeliveryStatus | null;
  dataTestId?: string;
}) => {
  const { status, dataTestId } = props;
  switch (status) {
    case 'sending':
      return <MessageStatusSending dataTestId={dataTestId} />;
    case 'sent':
      return <MessageStatusSent dataTestId={dataTestId} />;
    case 'read':
      return <MessageStatusRead dataTestId={dataTestId} />;
    case 'error':
      return <MessageStatusError dataTestId={dataTestId} />;
    default:
      return null;
  }
};
