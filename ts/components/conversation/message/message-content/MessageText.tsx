import classNames from 'classnames';
import React from 'react';
import { useSelector } from 'react-redux';
import { MessageRenderingProps } from '../../../../models/messageType';
import {
  getMessageTextProps,
  isMessageSelectionMode,
} from '../../../../state/selectors/conversations';
import { SessionIcon } from '../../../icon';
import { MessageBody } from './MessageBody';

type Props = {
  messageId: string;
};

export type MessageTextSelectorProps = Pick<
  MessageRenderingProps,
  'text' | 'direction' | 'status' | 'isDeleted' | 'conversationType'
>;

export const MessageText = (props: Props) => {
  const selected = useSelector(state => getMessageTextProps(state as any, props.messageId));
  const multiSelectMode = useSelector(isMessageSelectionMode);

  if (!selected) {
    return null;
  }
  const { text, direction, status, isDeleted, conversationType } = selected;

  const contents = isDeleted
    ? window.i18n('messageDeletedPlaceholder')
    : direction === 'incoming' && status === 'error'
    ? window.i18n('incomingError')
    : text;

  if (!contents) {
    return null;
  }

  return (
    <div
      dir="auto"
      className={classNames(
        'module-message__text',
        `module-message__text--${direction}`,
        status === 'error' && direction === 'incoming' ? 'module-message__text--error' : null
      )}
    >
      {isDeleted && <SessionIcon iconType="delete" iconSize="small" />}
      <MessageBody
        text={contents || ''}
        disableLinks={multiSelectMode}
        disableJumbomoji={false}
        isGroup={conversationType === 'group'}
      />
    </div>
  );
};
