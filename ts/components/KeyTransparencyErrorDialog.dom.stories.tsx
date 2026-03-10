// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Meta } from '@storybook/react';
import React, { useState } from 'react';
import { action } from '@storybook/addon-actions';
import { KeyTransparencyErrorDialog } from './KeyTransparencyErrorDialog.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/KeyTransparencyErrorDialog',
} satisfies Meta;

export function Default(): React.JSX.Element {
  const [open, setOpen] = useState(true);
  return (
    <KeyTransparencyErrorDialog
      i18n={i18n}
      open={open}
      onOpenChange={setOpen}
      onSubmit={action('onSubmit')}
      onViewDebugLog={action('onViewDebugLog')}
      isSubmitting={false}
    />
  );
}
