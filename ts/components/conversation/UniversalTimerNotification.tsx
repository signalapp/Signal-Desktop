// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { SystemMessage } from './SystemMessage';
import type { LocalizerType } from '../../types/Util';
import * as expirationTimer from '../../util/expirationTimer';

export type Props = {
  i18n: LocalizerType;
  expireTimer: number;
};

export const UniversalTimerNotification: React.FC<Props> = props => {
  const { i18n, expireTimer } = props;

  if (!expireTimer) {
    return null;
  }

  const timeValue = expirationTimer.format(i18n, expireTimer);

  return (
    <SystemMessage
      icon="timer"
      contents={i18n('UniversalTimerNotification__text', {
        timeValue,
      })}
    />
  );
};
