// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { LocalizerType } from '../../types/Util';
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
    <div className="SystemMessage">
      <div className="SystemMessage__icon SystemMessage__icon--timer" />
      <div className="SystemMessage__text">
        <div>
          {i18n('UniversalTimerNotification__text', {
            timeValue,
          })}
        </div>
      </div>
    </div>
  );
};
