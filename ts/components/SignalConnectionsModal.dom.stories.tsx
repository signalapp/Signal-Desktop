// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Meta } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { SignalConnectionsModal } from './SignalConnectionsModal.dom.tsx';
import type { ReactNode } from 'react';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/SignalConnectionsModal',
} satisfies Meta;

export function Default(): ReactNode {
  return <SignalConnectionsModal i18n={i18n} onClose={action('onClose')} />;
}
