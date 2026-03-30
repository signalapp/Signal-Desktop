// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback } from 'react';
import type { LocalizerType } from '../types/Util.std.ts';
import { AxoAlertDialog } from '../axo/AxoAlertDialog.dom.tsx';

export type PropsType = Readonly<{
  i18n: LocalizerType;
  onClose: () => void;
  onRetry: () => void;
}>;

export function TerminateGroupFailedModal(props: PropsType): React.JSX.Element {
  const { i18n, onClose, onRetry } = props;
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
          <AxoAlertDialog.Description>
            {i18n('icu:TerminateGroupFailedModal__description')}
          </AxoAlertDialog.Description>
        </AxoAlertDialog.Body>
        <AxoAlertDialog.Footer>
          <AxoAlertDialog.Cancel>{i18n('icu:cancel')}</AxoAlertDialog.Cancel>
          <AxoAlertDialog.Action variant="secondary" onClick={onRetry}>
            {i18n('icu:TerminateGroupFailedModal__try-again')}
          </AxoAlertDialog.Action>
        </AxoAlertDialog.Footer>
      </AxoAlertDialog.Content>
    </AxoAlertDialog.Root>
  );
}
