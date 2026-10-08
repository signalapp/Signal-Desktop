// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import classNames from 'classnames';

import { formatTime } from '../../util/formatTimestamp.dom.ts';

import type { LocalizerType } from '../../types/Util.std.ts';
import { Time } from '../Time.dom.tsx';
import { useNowThatUpdatesEveryMinute } from '../../hooks/useNowThatUpdatesEveryMinute.std.ts';

export type Props = {
  direction?: 'incoming' | 'outgoing';
  i18n: LocalizerType;
  isOutlineOnlyBubble?: boolean;
  isRelativeTime?: boolean;
  /** @deprecated */
  className?: string;
  timestamp: number;
  withImageNoCaption?: boolean;
  withSticker?: boolean;
  withTapToViewExpired?: boolean;
};

export function MessageTimestamp({
  direction,
  i18n,
  isRelativeTime,
  isOutlineOnlyBubble,
  className,
  timestamp,
  withImageNoCaption,
  withSticker,
}: Readonly<Props>): ReactElement {
  const now = useNowThatUpdatesEveryMinute();

  return (
    <Time
      className={classNames(
        'module-timestamp',
        direction === 'incoming' && 'module-timestamp--incoming',
        direction === 'outgoing' && 'module-timestamp--outgoing',
        withImageNoCaption ? 'module-timestamp--with-image-no-caption' : null,
        withSticker ? 'module-timestamp--with-sticker' : null,
        isOutlineOnlyBubble ? 'module-timestamp--outline-only-bubble' : null,
        className
      )}
      timestamp={timestamp}
    >
      {formatTime(i18n, timestamp, now, isRelativeTime)}
    </Time>
  );
}
