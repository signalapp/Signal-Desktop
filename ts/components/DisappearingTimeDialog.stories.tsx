// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';

import { DisappearingTimeDialog } from './DisappearingTimeDialog';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

import { EXPIRE_TIMERS } from '../test-both/util/expireTimers';

export default {
  title: 'Components/DisappearingTimeDialog',
};

const i18n = setupI18n('en', enMessages);

export const Seconds = (): JSX.Element => (
  <DisappearingTimeDialog
    i18n={i18n}
    initialValue={EXPIRE_TIMERS[0].value}
    onSubmit={action('onSubmit')}
    onClose={action('onClose')}
  />
);

export const Minutes = (): JSX.Element => (
  <DisappearingTimeDialog
    i18n={i18n}
    initialValue={EXPIRE_TIMERS[1].value}
    onSubmit={action('onSubmit')}
    onClose={action('onClose')}
  />
);

export const Hours = (): JSX.Element => (
  <DisappearingTimeDialog
    i18n={i18n}
    initialValue={EXPIRE_TIMERS[2].value}
    onSubmit={action('onSubmit')}
    onClose={action('onClose')}
  />
);

export const Days = (): JSX.Element => (
  <DisappearingTimeDialog
    i18n={i18n}
    initialValue={EXPIRE_TIMERS[3].value}
    onSubmit={action('onSubmit')}
    onClose={action('onClose')}
  />
);

export const Weeks = (): JSX.Element => (
  <DisappearingTimeDialog
    i18n={i18n}
    initialValue={EXPIRE_TIMERS[4].value}
    onSubmit={action('onSubmit')}
    onClose={action('onClose')}
  />
);
