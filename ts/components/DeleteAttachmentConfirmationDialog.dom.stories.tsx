// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Meta } from '@storybook/react';
import React, { useState } from 'react';
import { action } from '@storybook/addon-actions';
import { DeleteAttachmentConfirmationDialog } from './DeleteAttachmentConfirmationDialog.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/DeleteAttachmentConfirmationDialog',
} satisfies Meta;

export function Default(): React.JSX.Element {
  const [open, setOpen] = useState(true);
  return (
    <DeleteAttachmentConfirmationDialog
      i18n={i18n}
      open={open}
      onOpenChange={setOpen}
      onDestroyAttachment={action('onDestroyAttachment')}
    />
  );
}
