// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './SafetyNumberNotReady';
import { SafetyNumberNotReady } from './SafetyNumberNotReady';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/SafetyNumberNotReady',
} satisfies Meta<PropsType>;

export function Default(): JSX.Element {
  return <SafetyNumberNotReady i18n={i18n} onClose={action('close')} />;
}
