import React from 'react';
import { MessageRenderingProps } from '../../../../models/messageType';
import { useMessageDirection, useMessageStatus } from '../../../../state/selectors';
import { OutgoingMessageStatus } from './OutgoingMessageStatus';

type Props = {
  isCorrectSide: boolean;
  isDetailView: boolean;
  messageId: string;
  dataTestId?: string;
};

export type MessageStatusSelectorProps = Pick<MessageRenderingProps, 'direction' | 'status'>;

export const MessageStatus = (props: Props) => {
  const { messageId, isCorrectSide, isDetailView, dataTestId } = props;
  const direction = useMessageDirection(props.messageId);
  const status = useMessageStatus(props.messageId);

  if (!messageId) {
    return null;
  }

  if (!isCorrectSide || isDetailView) {
    return null;
  }
  const isIncoming = direction === 'incoming';

  const showStatus = !isIncoming && Boolean(status);
  if (!showStatus) {
    return null;
  }

  return <OutgoingMessageStatus messageId={messageId} dataTestId={dataTestId} status={status} />;
};
