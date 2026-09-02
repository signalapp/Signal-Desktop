// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { JSX } from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { LinkedDevicesOnboardingDialog } from './LinkedDevicesOnboardingDialog.dom.tsx';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Preferences/LinkedDevicesOnboarding',
} satisfies Meta;

export function Default(): JSX.Element {
  return (
    <LinkedDevicesOnboardingDialog i18n={i18n} onDismiss={action('onClose')} />
  );
}
