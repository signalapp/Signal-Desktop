// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX, ReactElement } from 'react';
import React, { useEffect, useState } from 'react';
import * as durations from '../../util/durations/index.std.ts';
import type { LocalizerType } from '../../types/Util.std.ts';
import { formatDate } from '../../util/formatTimestamp.dom.ts';
import { Time } from '../Time.dom.tsx';
import { tw } from '../../axo/tw.dom.tsx';

export function TimelineDateHeader({
  i18n,
  timestamp,
  isSignalConversation,
}: Readonly<{
  i18n: LocalizerType;
  timestamp: number;
  isSignalConversation?: boolean;
}>): ReactElement {
  return (
    <div className={tw('flex justify-center p-5')}>
      <div
        className={tw(
          'type-body-medium text-label-primary select-none',
          isSignalConversation
            ? 'rounded-3xl border border-border-secondary bg-legacy-signal-conversation-bg px-2.5 py-1 ' +
                'type-body-small font-medium text-label-secondary dark:text-label-secondary-on-color'
            : null
        )}
      >
        <TimelineDate i18n={i18n} timestamp={timestamp} />
      </div>
    </div>
  );
}

export function TimelineDate({
  i18n,
  timestamp,
}: Readonly<{
  i18n: LocalizerType;
  timestamp: number;
}>): JSX.Element {
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
    <Time dateOnly timestamp={timestamp}>
      {text}
    </Time>
  );
}
