// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';

import { Button, ButtonVariant } from './Button';
import { ConfirmDiscardDialog } from './ConfirmDiscardDialog';
import type { LocalizerType } from '../types/Util';
import { Modal } from './Modal';

export type PropsType = {
  hasChanges: boolean;
  i18n: LocalizerType;
  onCancel: () => unknown;
  onSave: () => unknown;
};

export const AvatarModalButtons = ({
  hasChanges,
  i18n,
  onCancel,
  onSave,
}: PropsType): JSX.Element => {
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
        {i18n('cancel')}
      </Button>
      <Button disabled={!hasChanges} onClick={onSave}>
        {i18n('save')}
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
};
