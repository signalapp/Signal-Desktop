// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { LocalizerType } from '../../types/Util';
import * as expirationTimer from '../../util/expirationTimer';

export type Props = {
  i18n: LocalizerType;
  expireTimer: number;
};

const CSS_MODULE = 'module-universal-timer-notification';

export const UniversalTimerNotification: React.FC<Props> = props => {
  const { i18n, expireTimer } = props;

  if (!expireTimer) {
    return null;
  }

  const timeValue = expirationTimer.format(i18n, expireTimer);

  return (
    <div className={CSS_MODULE}>
      <div className={`${CSS_MODULE}__icon-container`}>
        <div className={`${CSS_MODULE}__icon`} />
        <div className={`${CSS_MODULE}__icon-label`}>{timeValue}</div>
      </div>
      <div className={`${CSS_MODULE}__message`}>
        {i18n('UniversalTimerNotification__text', {
          timeValue,
        })}
      </div>
    </div>
  );
};
