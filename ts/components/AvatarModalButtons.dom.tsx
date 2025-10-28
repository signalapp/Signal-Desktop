// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import { ConfirmDiscardDialog } from './ConfirmDiscardDialog.dom.js';
import type { LocalizerType } from '../types/Util.std.js';
import { Modal } from './Modal.dom.js';
import { AxoButton } from '../axo/AxoButton.dom.js';

export type PropsType = {
  hasChanges: boolean;
  i18n: LocalizerType;
  onCancel: () => unknown;
  onSave: () => unknown;
};

export function AvatarModalButtons({
  hasChanges,
  i18n,
  onCancel,
  onSave,
}: PropsType): JSX.Element {
  const [confirmDiscardAction, setConfirmDiscardAction] = useState<
    (() => unknown) | undefined
  >(undefined);

  return (
    <Modal.ButtonFooter>
      <AxoButton.Root
        variant="secondary"
        size="large"
        onClick={() => {
          if (hasChanges) {
            setConfirmDiscardAction(() => onCancel);
          } else {
            onCancel();
          }
        }}
      >
        {i18n('icu:cancel')}
      </AxoButton.Root>
      <AxoButton.Root
        variant="primary"
        size="large"
        disabled={!hasChanges}
        onClick={onSave}
      >
        {i18n('icu:save')}
      </AxoButton.Root>
      {confirmDiscardAction && (
        <ConfirmDiscardDialog
          i18n={i18n}
          onDiscard={confirmDiscardAction}
          onClose={() => setConfirmDiscardAction(undefined)}
        />
      )}
    </Modal.ButtonFooter>
  );
}
