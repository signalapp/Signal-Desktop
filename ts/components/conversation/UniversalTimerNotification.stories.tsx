// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { storiesOf } from '@storybook/react';

import { UniversalTimerNotification } from './UniversalTimerNotification';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';

import { EXPIRE_TIMERS } from '../../test-both/util/expireTimers';

const story = storiesOf('Components/UniversalTimerNotification', module);

const i18n = setupI18n('en', enMessages);

EXPIRE_TIMERS.forEach(({ value: ms, label }) => {
  story.add(`Initial value: ${label}`, () => {
    return <UniversalTimerNotification i18n={i18n} expireTimer={ms / 1000} />;
  });
});
