// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import * as styles from './MessageSticker.scss';
import type { Props as MessageMetaProps } from './MessageMeta';
import { MessageMeta } from './MessageMeta';

export type Props = MessageMetaProps & {
  image: string;
};

export function MessageSticker({
  image,
  kind,
  minutesAgo,
}: Props): JSX.Element {
  return (
    <div className={styles.base}>
      <img src={image} alt="Sticker" className={styles.image} />
      <MessageMeta kind={kind} minutesAgo={minutesAgo} />
    </div>
  );
}
