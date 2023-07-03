import React from 'react';
import { MessageRenderingProps } from '../../../../models/messageType';
import { OutgoingMessageStatus } from './OutgoingMessageStatus';
import { useMessageDirection, useMessageStatus } from '../../../../state/selectors';

type Props = {
  isCorrectSide: boolean;
  messageId: string;
  dataTestId?: string;
};

export type MessageStatusSelectorProps = Pick<MessageRenderingProps, 'direction' | 'status'>;

export const MessageStatus = (props: Props) => {
  const { isCorrectSide, dataTestId } = props;
  const direction = useMessageDirection(props.messageId);
  const status = useMessageStatus(props.messageId);

  if (!props.messageId) {
    return null;
  }

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
