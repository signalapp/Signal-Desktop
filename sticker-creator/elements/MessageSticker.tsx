// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import * as styles from './MessageSticker.scss';
import type { Props as MessageMetaProps } from './MessageMeta';
import { MessageMeta } from './MessageMeta';

export type Props = MessageMetaProps & {
  image: string;
};

export const MessageSticker: React.ComponentType<Props> = ({
  image,
  kind,
  minutesAgo,
}) => {
  return (
    <div className={styles.base}>
      <img src={image} alt="Sticker" className={styles.image} />
      <MessageMeta kind={kind} minutesAgo={minutesAgo} />
    </div>
  );
};
