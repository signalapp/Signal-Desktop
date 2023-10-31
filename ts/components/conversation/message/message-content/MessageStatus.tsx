import { ipcRenderer } from 'electron';
import React from 'react';
import styled from 'styled-components';
import { useMessageExpirationPropsById } from '../../../../hooks/useParamSelector';
import { useMessageStatus } from '../../../../state/selectors';

import { SpacerXS } from '../../../basic/Text';
import { SessionIcon, SessionIconType } from '../../../icon';
import { ExpireTimer } from '../../ExpireTimer';

type Props = {
  messageId: string;
  dataTestId?: string | undefined;
};

export const MessageStatus = (props: Props) => {
  const { dataTestId, messageId } = props;
  const status = useMessageStatus(props.messageId);
  const selected = useMessageExpirationPropsById(props.messageId);

  if (!props.messageId || !selected) {
    return null;
  }
  const isIncoming = selected.direction === 'incoming';

  if (isIncoming) {
    if (selected.isUnread || !selected.expirationDurationMs || !selected.expirationTimestamp) {
      return null;
    }
    return (
      <MessageStatusRead dataTestId={dataTestId} messageId={messageId} reserveDirection={true} />
    );
  }

  // this is the outgoing state: we display the text and the icon or the text and the expiretimer stopwatch when the message is expiring
  switch (status) {
    case 'sending':
      return <MessageStatusSending dataTestId={dataTestId} messageId={messageId} />;
    case 'sent':
      return <MessageStatusSent dataTestId={dataTestId} messageId={messageId} />;
    case 'read':
      return <MessageStatusRead dataTestId={dataTestId} messageId={messageId} />;
    case 'error':
      return <MessageStatusError dataTestId={dataTestId} messageId={messageId} />;
    default:
      return null;
  }
};

const MessageStatusContainer = styled.div<{ reserveDirection?: boolean }>`
  display: inline-block;
  align-self: flex-end;
  margin-bottom: 2px;
  margin-inline-start: 5px;
  cursor: pointer;
  display: flex;
  align-items: baseline;
  flex-direction: ${props =>
    props.reserveDirection
      ? 'row-reverse'
      : 'row'}; // we want {icon}{text} for incoming read messages, but {text}{icon} for outgoing messages
`;

const StyledStatusText = styled.div`
  color: var(--text-secondary-color);
  font-size: small;
`;

const TextDetails = ({ text }: { text: string }) => {
  return (
    <>
      <StyledStatusText>{text}</StyledStatusText>
      <SpacerXS />
    </>
  );
};

function IconDanger({ iconType }: { iconType: SessionIconType }) {
  return <SessionIcon iconColor={'var(--danger-color'} iconType={iconType} iconSize="tiny" />;
}

function IconNormal({
  iconType,
  rotateDuration,
}: {
  iconType: SessionIconType;
  rotateDuration?: number | undefined;
}) {
  return (
    <SessionIcon
      rotateDuration={rotateDuration}
      iconColor={'var(--text-secondary-color)'}
      iconType={iconType}
      iconSize="tiny"
    />
  );
}

function useIsExpiring(messageId: string) {
  const selected = useMessageExpirationPropsById(messageId);
  return (
    selected && selected.expirationDurationMs && selected.expirationTimestamp && !selected.isExpired
  );
}

function MessageStatusExpireTimer(props: Props) {
  const selected = useMessageExpirationPropsById(props.messageId);
  if (
    !selected ||
    !selected.expirationDurationMs ||
    !selected.expirationTimestamp ||
    selected.isExpired
  ) {
    return null;
  }
  return (
    <ExpireTimer
      expirationDurationMs={selected.expirationDurationMs}
      expirationTimestamp={selected.expirationTimestamp}
    />
  );
}

const MessageStatusSending = ({ dataTestId }: Props) => {
  // while sending, we do not display the expire timer at all.
  return (
    <MessageStatusContainer data-testid={dataTestId} data-testtype="sending">
      <TextDetails text={window.i18n('sending')} />
      <IconNormal rotateDuration={2} iconType="sending" />
    </MessageStatusContainer>
  );
};

const MessageStatusSent = ({ dataTestId, messageId }: Props) => {
  const isExpiring = useIsExpiring(messageId);

  return (
    <MessageStatusContainer data-testid={dataTestId} data-testtype="sent">
      <TextDetails text={window.i18n('sent')} />
      {isExpiring ? (
        <MessageStatusExpireTimer messageId={messageId} />
      ) : (
        <IconNormal iconType="circleCheck" />
      )}
    </MessageStatusContainer>
  );
};

const MessageStatusRead = ({
  dataTestId,
  messageId,
  reserveDirection,
}: Props & { reserveDirection?: boolean }) => {
  const isExpiring = useIsExpiring(messageId);
  return (
    <MessageStatusContainer
      data-testid={dataTestId}
      data-testtype="read"
      reserveDirection={reserveDirection}
    >
      <TextDetails text={window.i18n('read')} />
      {isExpiring ? (
        <MessageStatusExpireTimer messageId={messageId} />
      ) : (
        <IconNormal iconType="doubleCheckCircleFilled" />
      )}
    </MessageStatusContainer>
  );
};

const MessageStatusError = ({ dataTestId }: Props) => {
  const showDebugLog = () => {
    ipcRenderer.send('show-debug-log');
  };
  // when on errro, we do not display the expire timer at all.

  return (
    <MessageStatusContainer
      data-testid={dataTestId}
      data-testtype="failed"
      onClick={showDebugLog}
      title={window.i18n('sendFailed')}
    >
      <TextDetails text={window.i18n('failed')} />
      <IconDanger iconType="error" />
    </MessageStatusContainer>
  );
};
