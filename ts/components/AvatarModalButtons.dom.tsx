// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState, type JSX } from 'react';
import type { LocalizerType } from '../types/Util.std.ts';
import { Modal } from './Modal.dom.tsx';
import { AxoButton } from '../axo/AxoButton.dom.tsx';
import { AxoConfirmDialog } from '../axo/AxoConfirmDialog.dom.tsx';
import { strictAssert } from '../util/assert.std.ts';

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
    (() => void) | undefined
  >(undefined);

  return (
    <Modal.ButtonFooter>
      <AxoButton.Root
        variant="secondary"
        size="lg"
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
        size="lg"
        disabled={!hasChanges}
        onClick={onSave}
      >
        {i18n('icu:save')}
      </AxoButton.Root>
      <AxoConfirmDialog.Root
        open={confirmDiscardAction != null}
        onOpenChange={() => setConfirmDiscardAction(undefined)}
        // @ts-expect-error ConfirmationDialog migration: Needs title
        title={null}
        // @ts-expect-error ConfirmationDialog migration: Needs description
        description={null}
      >
        <AxoConfirmDialog.Cancel />
        <AxoConfirmDialog.Action
          variant="destructive"
          onClick={() => {
            strictAssert(
              confirmDiscardAction != null,
              'Missing confirmDiscardAction'
            );
            confirmDiscardAction();
          }}
        >
          {i18n('icu:discard')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>
    </Modal.ButtonFooter>
  );
}
