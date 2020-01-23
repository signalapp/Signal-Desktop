import * as React from 'react';
import * as styles from './MessageBubble.scss';
import { MessageMeta, Props as MessageMetaProps } from './MessageMeta';

export type Props = Pick<MessageMetaProps, 'minutesAgo'> & {
  children: React.ReactNode;
};

export const MessageBubble = ({ children, minutesAgo }: Props) => {
  return (
    <div className={styles.base}>
      {children}
      <MessageMeta kind="bubble" minutesAgo={minutesAgo} />
    </div>
  );
};
