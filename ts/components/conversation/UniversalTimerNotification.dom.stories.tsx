// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { Meta } from '@storybook/react';
import type { Props } from './UniversalTimerNotification.dom.js';
import { UniversalTimerNotification } from './UniversalTimerNotification.dom.js';
import { EXPIRE_TIMERS } from '../../test-helpers/expireTimers.std.js';

export default {
  title: 'Components/UniversalTimerNotification',
} satisfies Meta<Props>;

const { i18n } = window.SignalContext;

export function Seconds(): JSX.Element {
  return (
    <UniversalTimerNotification
      i18n={i18n}
      expireTimer={EXPIRE_TIMERS[0].value}
    />
  );
}

export function Minutes(): JSX.Element {
  return (
    <UniversalTimerNotification
      i18n={i18n}
      expireTimer={EXPIRE_TIMERS[1].value}
    />
  );
}

export function Hours(): JSX.Element {
  return (
    <UniversalTimerNotification
      i18n={i18n}
      expireTimer={EXPIRE_TIMERS[2].value}
    />
  );
}

export function Days(): JSX.Element {
  return (
    <UniversalTimerNotification
      i18n={i18n}
      expireTimer={EXPIRE_TIMERS[3].value}
    />
  );
}

export function Weeks(): JSX.Element {
  return (
    <UniversalTimerNotification
      i18n={i18n}
      expireTimer={EXPIRE_TIMERS[4].value}
    />
  );
}
