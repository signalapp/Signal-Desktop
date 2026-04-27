// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { SystemMessage } from './SystemMessage.dom.tsx';
import type { LocalizerType } from '../../types/Util.std.ts';
import * as expirationTimer from '../../util/expirationTimer.std.ts';
import type { DurationInSeconds } from '../../util/durations/index.std.ts';

export type Props = {
  i18n: LocalizerType;
  expireTimer: DurationInSeconds;
};

export function UniversalTimerNotification(
  props: Props
): React.JSX.Element | null {
  const { i18n, expireTimer } = props;

  if (!expireTimer) {
    return null;
  }

  const timeValue = expirationTimer.format(i18n, expireTimer);

  return (
    <SystemMessage
      icon="timer"
      contents={i18n('icu:UniversalTimerNotification__text', {
        timeValue,
      })}
    />
  );
}
