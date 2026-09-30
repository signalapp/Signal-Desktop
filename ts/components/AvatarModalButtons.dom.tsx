// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useState, type JSX, type ReactNode } from 'react';
import type { LocalizerType } from '../types/Util.std.ts';
import { AxoButton } from '../axo/AxoButton.dom.tsx';
import { AxoConfirmDialog } from '../axo/AxoConfirmDialog.dom.tsx';
import { strictAssert } from '../util/assert.std.ts';
import { tw } from '../axo/tw.dom.tsx';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';

export type PropsType = {
  isInsideDialog: boolean;
  hasChanges: boolean;
  i18n: LocalizerType;
  onCancel: () => unknown;
  onSave: () => unknown;
};

export function AvatarModalButtons({
  isInsideDialog,
  hasChanges,
  i18n,
  onCancel,
  onSave,
}: PropsType): JSX.Element {
  const [confirmDiscardAction, setConfirmDiscardAction] = useState<
    (() => void) | undefined
  >(undefined);

  const handleCancel = useCallback(() => {
    if (hasChanges) {
      setConfirmDiscardAction(() => onCancel);
    } else {
      onCancel();
    }
  }, [hasChanges, onCancel]);

  let actions: ReactNode;
  if (isInsideDialog) {
    actions = (
      <AxoDialog.Actions>
        <AxoDialog.Action variant="strong-secondary" onClick={handleCancel}>
          {i18n('icu:cancel')}
        </AxoDialog.Action>
        <AxoDialog.Action
          variant="strong-primary"
          disabled={!hasChanges}
          onClick={onSave}
        >
          {i18n('icu:save')}
        </AxoDialog.Action>
      </AxoDialog.Actions>
    );
  } else {
    actions = (
      <div
        className={tw(
          'ms-auto flex w-fit max-w-full flex-wrap items-center gap-2 py-2.5'
        )}
      >
        <AxoButton.Root
          width="grow"
          variant="strong-secondary"
          size="lg"
          onClick={handleCancel}
        >
          {i18n('icu:cancel')}
        </AxoButton.Root>
        <AxoButton.Root
          width="grow"
          variant="strong-primary"
          size="lg"
          disabled={!hasChanges}
          onClick={onSave}
        >
          {i18n('icu:save')}
        </AxoButton.Root>
      </div>
    );
  }

  return (
    <>
      {actions}
      <AxoConfirmDialog.Root
        open={confirmDiscardAction != null}
        onOpenChange={() => setConfirmDiscardAction(undefined)}
        // @ts-expect-error ConfirmationDialog migration: Needs title
        title={null}
        description={i18n('icu:ConfirmDiscardDialog--discard')}
      >
        <AxoConfirmDialog.Cancel />
        <AxoConfirmDialog.Action
          variant="strong-destructive"
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
    </>
  );
}
