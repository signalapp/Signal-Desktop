// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { type ReactNode, type JSX } from 'react';
import styles from './MessageBubble.module.scss';
import type { Props as MessageMetaProps } from './MessageMeta';
import { MessageMeta } from './MessageMeta';

export type Props = Pick<MessageMetaProps, 'minutesAgo'> & {
  children: ReactNode;
};

export function MessageBubble({ children, minutesAgo }: Props): JSX.Element {
  return (
    <div className={styles.base}>
      {children}
      <MessageMeta kind="bubble" minutesAgo={minutesAgo} />
    </div>
  );
}
