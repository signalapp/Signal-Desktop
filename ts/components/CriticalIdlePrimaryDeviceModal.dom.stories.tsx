// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta } from '@storybook/react';
import { type ReactNode } from 'react';
import { action } from '@storybook/addon-actions';
import { CriticalIdlePrimaryDeviceModal } from './CriticalIdlePrimaryDeviceModal.dom.tsx';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/CriticalIdlePrimaryDeviceModal',
} satisfies Meta;

export function Default(): ReactNode {
  return (
    <CriticalIdlePrimaryDeviceModal i18n={i18n} onClose={action('onClose')} />
  );
}
