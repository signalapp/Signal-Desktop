// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import type { LocalizerType } from '../types/I18N.std.ts';
import { AxoConfirmDialog } from '../axo/AxoConfirmDialog.dom.tsx';

export type DeleteAttachmentConfirmationDialogProps = Readonly<{
  i18n: LocalizerType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDestroyAttachment: () => void;
}>;

export function DeleteAttachmentConfirmationDialog(
  props: DeleteAttachmentConfirmationDialogProps
): ReactNode {
  const { i18n } = props;
  return (
    <AxoConfirmDialog.Root
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={i18n('icu:DeleteAttachmentModal__Title')}
      description={i18n('icu:DeleteAttachmentModal__Body')}
      escape="cancel-is-noop"
    >
      <AxoConfirmDialog.Cancel />
      <AxoConfirmDialog.Action
        variant="strong-destructive"
        onClick={props.onDestroyAttachment}
      >
        {i18n('icu:DeleteAttachmentModal__Delete')}
      </AxoConfirmDialog.Action>
    </AxoConfirmDialog.Root>
  );
}
