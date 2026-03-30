// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { DiscardDraftDialog } from './DiscardDraftDialog.dom.tsx';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/DiscardDraftDialog',
} satisfies Meta;

export function Default(): React.JSX.Element {
  return (
    <DiscardDraftDialog
      i18n={i18n}
      onClose={action('onClose')}
      onDiscard={action('onDiscard')}
    />
  );
}
