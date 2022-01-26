// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import * as durations from '../../util/durations';
import type { LocalizerType } from '../../types/Util';
import { formatDate } from '../../util/timestamp';
import { Time } from '../Time';

export function TimelineDateHeader({
  floating = false,
  i18n,
  timestamp,
}: Readonly<{
  floating?: boolean;
  i18n: LocalizerType;
  timestamp: number;
}>): ReactElement {
  const [text, setText] = useState(formatDate(i18n, timestamp));
  useEffect(() => {
    const update = () => setText(formatDate(i18n, timestamp));
    update();
    const interval = setInterval(update, durations.MINUTE);
    return () => {
      clearInterval(interval);
    };
  }, [i18n, timestamp]);

  return (
    <Time
      className={classNames(
        'TimelineDateHeader',
        `TimelineDateHeader--${floating ? 'floating' : 'inline'}`
      )}
      dateOnly
      timestamp={timestamp}
    >
      {text}
    </Time>
  );
}
