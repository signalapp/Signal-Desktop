// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './MuteUntilDialog.dom.tsx';
import { MuteUntilDialog } from './MuteUntilDialog.dom.tsx';

export default {
  title: 'Components/MuteUntilDialog',
} satisfies Meta<PropsType>;

const { i18n } = window.SignalContext;

export function Default(): JSX.Element {
  return (
    <MuteUntilDialog
      i18n={i18n}
      open
      onSubmit={action('onSubmit')}
      onClose={action('onClose')}
    />
  );
}
