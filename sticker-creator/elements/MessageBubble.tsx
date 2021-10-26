// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import * as styles from './MessageBubble.scss';
import type { Props as MessageMetaProps } from './MessageMeta';
import { MessageMeta } from './MessageMeta';

export type Props = Pick<MessageMetaProps, 'minutesAgo'> & {
  children: React.ReactNode;
};

export const MessageBubble: React.ComponentType<Props> = ({
  children,
  minutesAgo,
}) => {
  return (
    <div className={styles.base}>
      {children}
      <MessageMeta kind="bubble" minutesAgo={minutesAgo} />
    </div>
  );
};
