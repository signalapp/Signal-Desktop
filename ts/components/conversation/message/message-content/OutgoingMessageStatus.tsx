import React from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import { LastMessageStatusType } from '../../../../state/ducks/conversations';
import { SessionIcon } from '../../../icon';
import { showMessageInfoOverlay } from './MessageContextMenu';

const MessageStatusSendingContainer = styled.div`
  display: inline-block;
  align-self: flex-end;
  margin-bottom: 2px;
  margin-inline-start: 5px;
  cursor: pointer;
`;

const iconColor = 'var(--text-primary-color)';

const MessageStatusSending = ({ dataTestId }: { dataTestId?: string }) => {
  return (
    <MessageStatusSendingContainer data-testid={dataTestId} data-testtype="sending">
      <SessionIcon rotateDuration={2} iconColor={iconColor} iconType="sending" iconSize="tiny" />
    </MessageStatusSendingContainer>
  );
};

const MessageStatusSent = ({ dataTestId }: { dataTestId?: string }) => {
  return (
    <MessageStatusSendingContainer data-testid={dataTestId} data-testtype="sent">
      <SessionIcon iconColor={iconColor} iconType="circleCheck" iconSize="tiny" />
    </MessageStatusSendingContainer>
  );
};

const MessageStatusRead = ({ dataTestId }: { dataTestId?: string }) => {
  return (
    <MessageStatusSendingContainer data-testid={dataTestId} data-testtype="read">
      <SessionIcon iconColor={iconColor} iconType="doubleCheckCircleFilled" iconSize="tiny" />
    </MessageStatusSendingContainer>
  );
};

const MessageStatusError = ({
  messageId,
  dataTestId,
}: {
  messageId?: string;
  dataTestId?: string;
}) => {
  const dispatch = useDispatch();

  return (
    <MessageStatusSendingContainer
      data-testid={dataTestId}
      data-testtype="failed"
      onClick={() => {
        if (messageId) {
          void showMessageInfoOverlay({ messageId, dispatch });
        }
      }}
      title={window.i18n('sendFailed')}
    >
      <SessionIcon iconColor={'var(--danger-color'} iconType="error" iconSize="tiny" />
    </MessageStatusSendingContainer>
  );
};

export const OutgoingMessageStatus = (props: {
  status: LastMessageStatusType | null;
  messageId?: string;
  dataTestId?: string;
}) => {
  const { status, messageId, dataTestId } = props;
  switch (status) {
    case 'sending':
      return <MessageStatusSending dataTestId={dataTestId} />;
    case 'sent':
      return <MessageStatusSent dataTestId={dataTestId} />;
    case 'read':
      return <MessageStatusRead dataTestId={dataTestId} />;
    case 'error':
      return <MessageStatusError messageId={messageId} dataTestId={dataTestId} />;
    default:
      return null;
  }
};
