// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { UniversalTimerNotification } from './UniversalTimerNotification';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';

import { EXPIRE_TIMERS } from '../../test-both/util/expireTimers';

export default {
  title: 'Components/UniversalTimerNotification',
};

const i18n = setupI18n('en', enMessages);

export const Seconds = (): JSX.Element => (
  <UniversalTimerNotification
    i18n={i18n}
    expireTimer={EXPIRE_TIMERS[0].value / 1000}
  />
);

export const Minutes = (): JSX.Element => (
  <UniversalTimerNotification
    i18n={i18n}
    expireTimer={EXPIRE_TIMERS[1].value / 1000}
  />
);

export const Hours = (): JSX.Element => (
  <UniversalTimerNotification
    i18n={i18n}
    expireTimer={EXPIRE_TIMERS[2].value / 1000}
  />
);

export const Days = (): JSX.Element => (
  <UniversalTimerNotification
    i18n={i18n}
    expireTimer={EXPIRE_TIMERS[3].value / 1000}
  />
);

export const Weeks = (): JSX.Element => (
  <UniversalTimerNotification
    i18n={i18n}
    expireTimer={EXPIRE_TIMERS[4].value / 1000}
  />
);
