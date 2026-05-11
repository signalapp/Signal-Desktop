// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import { action } from '@storybook/addon-actions';
import { type Meta } from '@storybook/react';
import {
  MaybeTransferModal,
  DeleteDataAndRelinkConfirmationDialog,
} from './MaybeTransferModal.dom.tsx';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/MaybeTransferModal',
} satisfies Meta;

export function UnlinkedMaybeTransferModal(): JSX.Element {
  return (
    <MaybeTransferModal
      open
      onDontTransfer={action('onDontTransfer')}
      onTransfer={action('onTransfer')}
      onCancel={action('onCancel')}
      i18n={i18n}
    />
  );
}

export function DeleteDataConfirmationDialog(): JSX.Element {
  return (
    <DeleteDataAndRelinkConfirmationDialog
      open
      onCancel={action('onCancel')}
      onConfirm={async () => action('onConfirm')()}
      i18n={i18n}
    />
  );
}
