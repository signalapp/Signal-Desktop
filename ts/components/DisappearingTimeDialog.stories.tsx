// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './DisappearingTimeDialog';
import { DisappearingTimeDialog } from './DisappearingTimeDialog';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

import { EXPIRE_TIMERS } from '../test-both/util/expireTimers';

export default {
  title: 'Components/DisappearingTimeDialog',
} satisfies Meta<PropsType>;

const i18n = setupI18n('en', enMessages);

export function Seconds(): JSX.Element {
  return (
    <DisappearingTimeDialog
      i18n={i18n}
      initialValue={EXPIRE_TIMERS[0].value}
      onSubmit={action('onSubmit')}
      onClose={action('onClose')}
    />
  );
}

export function Minutes(): JSX.Element {
  return (
    <DisappearingTimeDialog
      i18n={i18n}
      initialValue={EXPIRE_TIMERS[1].value}
      onSubmit={action('onSubmit')}
      onClose={action('onClose')}
    />
  );
}

export function Hours(): JSX.Element {
  return (
    <DisappearingTimeDialog
      i18n={i18n}
      initialValue={EXPIRE_TIMERS[2].value}
      onSubmit={action('onSubmit')}
      onClose={action('onClose')}
    />
  );
}

export function Days(): JSX.Element {
  return (
    <DisappearingTimeDialog
      i18n={i18n}
      initialValue={EXPIRE_TIMERS[3].value}
      onSubmit={action('onSubmit')}
      onClose={action('onClose')}
    />
  );
}

export function Weeks(): JSX.Element {
  return (
    <DisappearingTimeDialog
      i18n={i18n}
      initialValue={EXPIRE_TIMERS[4].value}
      onSubmit={action('onSubmit')}
      onClose={action('onClose')}
    />
  );
}
