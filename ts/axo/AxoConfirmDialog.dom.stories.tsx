// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import type { Meta } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { AxoConfirmDialog } from './AxoConfirmDialog.dom.tsx';

export default {
  title: 'Axo/AxoConfirmDialog',
} satisfies Meta;

export function Primary(): ReactNode {
  return (
    <AxoConfirmDialog.Root
      open
      onOpenChange={action('onOpenChange')}
      title="Save changes?"
      description="Do you want to save the changes you’ve made to this chat folder?"
    >
      <AxoConfirmDialog.Cancel />
      <AxoConfirmDialog.Action variant="primary" onClick={action('onSave')}>
        Save
      </AxoConfirmDialog.Action>
    </AxoConfirmDialog.Root>
  );
}

export function Destructive(): ReactNode {
  return (
    <AxoConfirmDialog.Root
      open
      onOpenChange={action('onOpenChange')}
      title="Discard draft?"
      description="This action can't be undone."
    >
      <AxoConfirmDialog.Cancel />
      <AxoConfirmDialog.Action
        variant="destructive"
        onClick={action('onDiscard')}
      >
        Discard
      </AxoConfirmDialog.Action>
    </AxoConfirmDialog.Root>
  );
}
