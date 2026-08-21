// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import { action } from '@storybook/addon-actions';
import { type Meta } from '@storybook/react';
import { PinReminderModal } from './PinReminderModal.dom.tsx';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/PinReminderModal',
} satisfies Meta;

export function Default(): JSX.Element {
  return (
    <PinReminderModal
      open
      onCancel={action('onCancel')}
      onPinEntry={() => Math.random() > 0.5}
      i18n={i18n}
    />
  );
}

export function WrongPin(): JSX.Element {
  return (
    <PinReminderModal
      internalHasValidationError
      open
      onCancel={action('onCancel')}
      onPinEntry={() => Math.random() > 0.5}
      i18n={i18n}
    />
  );
}
