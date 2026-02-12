// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useCallback } from 'react';
import type { LocalizerType } from '../types/I18N.std.js';
import { AxoDialog } from '../axo/AxoDialog.dom.js';

export function DeleteAttachmentConfirmationDialog({
  i18n,
  onDestroyAttachment,
  open,
  onOpenChange,
}: {
  i18n: LocalizerType;
  onDestroyAttachment: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.JSX.Element {
  const close = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <AxoDialog.Root open={open} onOpenChange={onOpenChange}>
      <AxoDialog.Content escape="cancel-is-noop" size="sm">
        <AxoDialog.Header>
          <AxoDialog.Title>
            {i18n('icu:DeleteAttachmentModal__Title')}
          </AxoDialog.Title>
          <AxoDialog.Close
            aria-label={i18n('icu:DeleteAttachmentModal__Close')}
          />
        </AxoDialog.Header>
        <AxoDialog.Body>
          {i18n('icu:DeleteAttachmentModal__Body')}
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action variant="secondary" onClick={close}>
              {i18n('icu:DeleteAttachmentModal__Cancel')}
            </AxoDialog.Action>
            <AxoDialog.Action
              variant="destructive"
              onClick={onDestroyAttachment}
            >
              {i18n('icu:DeleteAttachmentModal__Delete')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
