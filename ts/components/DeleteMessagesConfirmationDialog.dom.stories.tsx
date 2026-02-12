// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Meta } from '@storybook/react';
import React from 'react';
import { action } from '@storybook/addon-actions';
import { DeleteMessagesConfirmationDialog } from './DeleteMessagesConfirmationDialog.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/DeleteMessagesConfirmationDialog',
} satisfies Meta;

export function Default(): React.JSX.Element {
  return (
    <DeleteMessagesConfirmationDialog
      i18n={i18n}
      onClose={action('onClose')}
      onDestroyMessages={action('onDestroyMessages')}
    />
  );
}
