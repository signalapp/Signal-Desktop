// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useCallback } from 'react';
import type { LocalizerType } from '../types/I18N.std.js';
import { AxoAlertDialog } from '../axo/AxoAlertDialog.dom.js';

export type DiscardDraftDialogProps = Readonly<{
  i18n: LocalizerType;
  onClose: () => void;
  onDiscard: () => void;
}>;

export function DiscardDraftDialog(
  props: DiscardDraftDialogProps
): React.JSX.Element {
  const { i18n, onClose } = props;
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        onClose();
      }
    },
    [onClose]
  );

  return (
    <AxoAlertDialog.Root open onOpenChange={handleOpenChange}>
      <AxoAlertDialog.Content escape="cancel-is-noop">
        <AxoAlertDialog.Body>
          <AxoAlertDialog.Title>
            {i18n('icu:DiscardDraftDialog__title')}
          </AxoAlertDialog.Title>
          <AxoAlertDialog.Description>
            {i18n('icu:DiscardDraftDialog__description')}
          </AxoAlertDialog.Description>
        </AxoAlertDialog.Body>
        <AxoAlertDialog.Footer>
          <AxoAlertDialog.Cancel>{i18n('icu:cancel')}</AxoAlertDialog.Cancel>
          <AxoAlertDialog.Action
            variant="destructive"
            onClick={props.onDiscard}
          >
            {i18n('icu:discard')}
          </AxoAlertDialog.Action>
        </AxoAlertDialog.Footer>
      </AxoAlertDialog.Content>
    </AxoAlertDialog.Root>
  );
}
