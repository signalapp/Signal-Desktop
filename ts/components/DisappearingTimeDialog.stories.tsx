// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import { storiesOf } from '@storybook/react';

import { DisappearingTimeDialog } from './DisappearingTimeDialog';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

import { EXPIRE_TIMERS } from '../test-both/util/expireTimers';

const story = storiesOf('Components/DisappearingTimeDialog', module);

const i18n = setupI18n('en', enMessages);

EXPIRE_TIMERS.forEach(({ value, label }) => {
  story.add(`Initial value: ${label}`, () => {
    return (
      <DisappearingTimeDialog
        i18n={i18n}
        initialValue={value}
        onSubmit={action('onSubmit')}
        onClose={action('onClose')}
      />
    );
  });
});
