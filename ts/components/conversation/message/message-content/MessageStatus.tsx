import React from 'react';
import { useSelector } from 'react-redux';
import { MessageRenderingProps } from '../../../../models/messageType';
import { getMessageStatusProps } from '../../../../state/selectors/conversations';
import { OutgoingMessageStatus } from './OutgoingMessageStatus';

type Props = {
  isCorrectSide: boolean;
  messageId: string;
  dataTestId?: string;
};

export type MessageStatusSelectorProps = Pick<MessageRenderingProps, 'direction' | 'status'>;

export const MessageStatus = (props: Props) => {
  const { isCorrectSide, dataTestId } = props;

  const selected = useSelector(state => getMessageStatusProps(state as any, props.messageId));
  if (!selected) {
    return null;
  }
  const { status, direction } = selected;

  if (!isCorrectSide) {
    return null;
  }
  const isIncoming = direction === 'incoming';

  const showStatus = !isIncoming && Boolean(status);
  if (!showStatus) {
    return null;
  }

  return <OutgoingMessageStatus dataTestId={dataTestId} status={status} />;
};
