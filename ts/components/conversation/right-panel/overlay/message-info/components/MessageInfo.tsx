import { format, formatDistanceStrict } from 'date-fns';
import { ipcRenderer } from 'electron';
import { isEmpty } from 'lodash';
import moment from 'moment';

import React from 'react';
import styled from 'styled-components';
import { MessageFrom } from '.';
import {
  useMessageDirection,
  useMessageExpirationDurationMs,
  useMessageExpirationTimestamp,
  useMessageExpirationType,
  useMessageHash,
  useMessageReceivedAt,
  useMessageSender,
  useMessageSenderIsAdmin,
  useMessageServerId,
  useMessageServerTimestamp,
  useMessageTimestamp,
} from '../../../../../../state/selectors';

import { isDevProd } from '../../../../../../shared/env_vars';
import { Flex } from '../../../../../basic/Flex';
import { SpacerSM } from '../../../../../basic/Text';

export const MessageInfoLabel = styled.label<{ color?: string }>`
  font-size: var(--font-size-lg);
  font-weight: bold;
  ${props => props.color && `color: ${props.color};`}
`;

const MessageInfoData = styled.div<{ color?: string }>`
  font-size: var(--font-size-md);
  user-select: text;
  ${props => props.color && `color: ${props.color};`}
`;

const LabelWithInfoContainer = styled.div`
  margin-bottom: var(--margins-md);
  ${props => props.onClick && 'cursor: pointer;'}
`;

type LabelWithInfoProps = {
  label: string;
  info: string;
  labelColor?: string;
  dataColor?: string;
  title?: string;
  onClick?: () => void;
};

export const LabelWithInfo = (props: LabelWithInfoProps) => {
  return (
    <LabelWithInfoContainer title={props.title || undefined} onClick={props.onClick}>
      <MessageInfoLabel color={props.labelColor}>{props.label}</MessageInfoLabel>
      <MessageInfoData color={props.dataColor}>{props.info}</MessageInfoData>
    </LabelWithInfoContainer>
  );
};

// Message timestamp format: "06:02 PM Tue, 15/11/2022"
const formatTimestamps = 'hh:mm A ddd, D/M/Y';

const showDebugLog = () => {
  ipcRenderer.send('show-debug-log');
};

const DebugMessageInfo = ({ messageId }: { messageId: string }) => {
  const messageHash = useMessageHash(messageId);
  const serverId = useMessageServerId(messageId);
  const expirationType = useMessageExpirationType(messageId);
  const expirationDurationMs = useMessageExpirationDurationMs(messageId);
  const expirationTimestamp = useMessageExpirationTimestamp(messageId);

  if (!isDevProd()) {
    return null;
  }

  return (
    <>
      {messageHash ? (
        <LabelWithInfo label={`${window.i18n('messageHash')}:`} info={messageHash} />
      ) : null}
      {serverId ? (
        <LabelWithInfo label={`${window.i18n('serverId')}:`} info={`${serverId}`} />
      ) : null}
      {expirationType ? (
        <LabelWithInfo label={`${window.i18n('expirationType')}:`} info={expirationType} />
      ) : null}
      {expirationDurationMs ? (
        <LabelWithInfo
          label={`${window.i18n('expirationDuration')}:`}
          // formatDistanceStrict (date-fns) is not localized yet
          info={`${formatDistanceStrict(0, Math.floor(expirationDurationMs / 1000))}`}
        />
      ) : null}
      {expirationTimestamp ? (
        <LabelWithInfo
          label={`${window.i18n('disappears')}:`}
          // format (date-fns) is not localized yet
          info={`${format(expirationTimestamp, 'PPpp')}`}
        />
      ) : null}
    </>
  );
};

export const MessageInfo = ({ messageId, errors }: { messageId: string; errors: Array<Error> }) => {
  const sender = useMessageSender(messageId);
  const direction = useMessageDirection(messageId);
  const sentAt = useMessageTimestamp(messageId);
  const serverTimestamp = useMessageServerTimestamp(messageId);
  const receivedAt = useMessageReceivedAt(messageId);
  const isSenderAdmin = useMessageSenderIsAdmin(messageId);

  if (!messageId || !sender) {
    return null;
  }

  const sentAtStr = `${moment(serverTimestamp || sentAt).format(formatTimestamps)}`;
  const receivedAtStr = `${moment(receivedAt).format(formatTimestamps)}`;

  const hasError = !isEmpty(errors);
  const errorString = hasError
    ? errors?.reduce((previous, current, currentIndex) => {
        return `${previous}${current.message}${
          errors.length > 1 && currentIndex < errors.length - 1 ? ', ' : ''
        }`;
      }, '')
    : null;

  return (
    <Flex container={true} flexDirection="column">
      <LabelWithInfo label={`${window.i18n('sent')}:`} info={sentAtStr} />
      <DebugMessageInfo messageId={messageId} />

      {direction === 'incoming' ? (
        <LabelWithInfo label={`${window.i18n('received')}:`} info={receivedAtStr} />
      ) : null}
      <SpacerSM />
      <MessageFrom sender={sender} isSenderAdmin={isSenderAdmin} />
      {hasError && (
        <>
          <SpacerSM />
          <LabelWithInfo
            title={window.i18n('shareBugDetails')}
            label={`${window.i18n('error')}:`}
            info={errorString || window.i18n('unknownError')}
            dataColor={'var(--danger-color)'}
            onClick={showDebugLog}
          />
        </>
      )}
    </Flex>
  );
};
