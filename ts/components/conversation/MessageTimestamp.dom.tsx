// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import classNames from 'classnames';

import { formatTime } from '../../util/formatTimestamp.dom.ts';

import type { LocalizerType } from '../../types/Util.std.ts';
import { Time } from '../Time.dom.tsx';
import { useNowThatUpdatesEveryMinute } from '../../hooks/useNowThatUpdatesEveryMinute.std.ts';

export type Props = {
  i18n: LocalizerType;
  isRelativeTime?: boolean;
  /** @deprecated */
  className?: string;
  timestamp: number;
  withSticker?: boolean;
  withTapToViewExpired?: boolean;
};

export function MessageTimestamp({
  i18n,
  isRelativeTime,
  className,
  timestamp,
  withSticker,
}: Readonly<Props>): ReactElement {
  const now = useNowThatUpdatesEveryMinute();

  return (
    <Time
      className={classNames(
        withSticker ? 'module-timestamp--with-sticker' : null,
        className
      )}
      timestamp={timestamp}
    >
      {formatTime(i18n, timestamp, now, isRelativeTime)}
    </Time>
  );
}
