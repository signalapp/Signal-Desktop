// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';

import { Button, ButtonVariant } from './Button.dom.js';
import { ConfirmDiscardDialog } from './ConfirmDiscardDialog.dom.js';
import type { LocalizerType } from '../types/Util.std.js';
import { Modal } from './Modal.dom.js';

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
      <Button
        onClick={() => {
          if (hasChanges) {
            setConfirmDiscardAction(() => onCancel);
          } else {
            onCancel();
          }
        }}
        variant={ButtonVariant.Secondary}
      >
        {i18n('icu:cancel')}
      </Button>
      <Button disabled={!hasChanges} onClick={onSave}>
        {i18n('icu:save')}
      </Button>
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
