// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { AxoConfirmDialog } from '../../../axo/AxoConfirmDialog.dom.tsx';
import { format as formatPhoneNumber } from '../../../types/PhoneNumber.std.ts';

import type { LocalizerType } from '../../../types/I18N.std.ts';

export function ConfirmPhoneNumberDialog({
  open,
  setOpen,
  phoneNumber,
  i18n,
  onEdit,
  onConfirm,
}: {
  open: boolean;
  setOpen: (open: boolean) => unknown;
  phoneNumber: string | undefined;
  i18n: LocalizerType;
  onEdit: () => unknown;
  onConfirm: () => unknown;
}): React.JSX.Element {
  return (
    <AxoConfirmDialog.Root
      open={open}
      onOpenChange={newOpen => {
        if (!newOpen) {
          setOpen(false);
        }
      }}
      title={
        phoneNumber ? formatPhoneNumber(phoneNumber, {}) : (phoneNumber ?? '')
      }
      description={i18n(
        'icu:StandaloneRegistration--PhoneNumber--Confirmation--description'
      )}
    >
      <AxoConfirmDialog.Action variant="subtle-secondary" onClick={onEdit}>
        {i18n('icu:StandaloneRegistration--PhoneNumber--Confirmation--cancel')}
      </AxoConfirmDialog.Action>
      <AxoConfirmDialog.Action variant="strong-primary" onClick={onConfirm}>
        {i18n('icu:StandaloneRegistration--PhoneNumber--Confirmation--confirm')}
      </AxoConfirmDialog.Action>
    </AxoConfirmDialog.Root>
  );
}
