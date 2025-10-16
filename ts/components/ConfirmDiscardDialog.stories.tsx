// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { ConfirmDialogProps } from './ConfirmDiscardDialog.dom.js';
import { ConfirmDiscardDialog } from './ConfirmDiscardDialog.dom.js';

const { i18n } = window.SignalContext;

const createProps = ({
  bodyText,
  discardText,
}: {
  bodyText?: string;
  discardText?: string;
} = {}): ConfirmDialogProps => ({
  i18n,
  bodyText,
  discardText,
  onClose: action('onClose'),
  onDiscard: action('onDiscard'),
});

export default {
  title: 'Components/ConfirmDiscardDialog',
} satisfies Meta<ConfirmDialogProps>;

export function Default(): JSX.Element {
  return <ConfirmDiscardDialog {...createProps()} />;
}

export function DonateFlow(): JSX.Element {
  return (
    <ConfirmDiscardDialog
      {...createProps({
        bodyText: i18n('icu:DonateFlow__discard-dialog-body'),
        discardText: i18n('icu:DonateFlow__discard-dialog-remove-info'),
      })}
    />
  );
}
