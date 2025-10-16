// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { ConfirmationDialog } from './ConfirmationDialog.dom.js';
import type { LocalizerType } from '../types/Util.std.js';

export type ConfirmDialogProps = {
  i18n: LocalizerType;
  bodyText?: string;
  discardText?: string;
  onClose: () => unknown;
  onDiscard: () => unknown;
};

export function ConfirmDiscardDialog({
  i18n,
  bodyText,
  discardText,
  onClose,
  onDiscard,
}: ConfirmDialogProps): JSX.Element {
  return (
    <ConfirmationDialog
      dialogName="ConfirmDiscardDialog"
      actions={[
        {
          action: onDiscard,
          text: discardText ?? i18n('icu:discard'),
          style: 'negative',
        },
      ]}
      i18n={i18n}
      onClose={onClose}
    >
      {bodyText ?? i18n('icu:ConfirmDiscardDialog--discard')}
    </ConfirmationDialog>
  );
}
