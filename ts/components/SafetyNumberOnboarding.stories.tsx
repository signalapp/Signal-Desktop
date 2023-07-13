// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';

import { SafetyNumberOnboarding } from './SafetyNumberOnboarding';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/SafetyNumberOnboarding',
};

export function Default(): JSX.Element {
  return <SafetyNumberOnboarding i18n={i18n} onClose={action('close')} />;
}

Default.story = {
  name: 'Safety Number Onboarding',
};
