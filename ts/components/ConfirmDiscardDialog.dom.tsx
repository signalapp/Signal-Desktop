// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';
import type { LocalizerType } from '../types/Util.std.ts';
import { AxoConfirmDialog } from '../axo/AxoConfirmDialog.dom.tsx';

export type ConfirmDialogProps = {
  i18n: LocalizerType;
  title: string;
  description: string;
  cancelLabel?: string;
  discardLabel?: string;
  onClose: () => void;
  onDiscard: () => void;
};

/** @deprecated */
export function ConfirmDiscardDialog({
  i18n,
  title,
  description,
  cancelLabel,
  discardLabel,
  onClose,
  onDiscard,
}: ConfirmDialogProps): JSX.Element {
  return (
    <AxoConfirmDialog.Root
      open
      onOpenChange={onClose}
      title={title}
      // Deprecated: APIs should provide description
      description={description ?? i18n('icu:ConfirmDiscardDialog--discard')}
    >
      <AxoConfirmDialog.Cancel>{cancelLabel}</AxoConfirmDialog.Cancel>
      <AxoConfirmDialog.Action variant="destructive" onClick={onDiscard}>
        {discardLabel ?? i18n('icu:discard')}
      </AxoConfirmDialog.Action>
    </AxoConfirmDialog.Root>
  );
}
