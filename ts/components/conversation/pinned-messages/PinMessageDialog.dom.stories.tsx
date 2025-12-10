// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useState } from 'react';
import type { Meta } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { PinMessageDialog } from './PinMessageDialog.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/PinnedMessages/PinMessageDialog',
} satisfies Meta;

export function Default(): JSX.Element {
  const [open, setOpen] = useState(true);
  return (
    <PinMessageDialog
      i18n={i18n}
      open={open}
      onOpenChange={setOpen}
      messageId="42"
      onPinnedMessageAdd={action('onPinnedMessageAdd')}
    />
  );
}
