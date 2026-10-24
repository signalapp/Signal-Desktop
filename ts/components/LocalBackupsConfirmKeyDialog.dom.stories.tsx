// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { LocalBackupsConfirmKeyDialog } from './LocalBackupsConfirmKeyDialog.dom.tsx';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/LocalBackupsConfirmKeyDialog',
} satisfies Meta;

export function Default(): ReactNode {
  return (
    <LocalBackupsConfirmKeyDialog
      i18n={i18n}
      onContinue={action('onContinue')}
    />
  );
}
