// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import type { LocalizerType } from '../../types/Util.std.ts';
import { AxoAlertDialog } from '../../axo/AxoAlertDialog.dom.tsx';

type OSAuthErrorDialogPropsType = Readonly<{
  i18n: LocalizerType;
  open: boolean;
  onOpenChange: (newOpen: boolean) => void;
}>;

export function OSAuthErrorDialog({
  i18n,
  open,
  onOpenChange,
}: OSAuthErrorDialogPropsType): ReactNode {
  return (
    <AxoAlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AxoAlertDialog.Content escape="cancel-is-noop">
        <AxoAlertDialog.Title screenReaderOnly>
          {i18n('icu:Toast--error')}
        </AxoAlertDialog.Title>
        <AxoAlertDialog.Body>
          <AxoAlertDialog.Description>
            {i18n('icu:Preferences__local-backups-auth-error--unauthorized')}
          </AxoAlertDialog.Description>
        </AxoAlertDialog.Body>
        <AxoAlertDialog.Footer>
          <AxoAlertDialog.Cancel>{i18n('icu:ok')}</AxoAlertDialog.Cancel>
        </AxoAlertDialog.Footer>
      </AxoAlertDialog.Content>
    </AxoAlertDialog.Root>
  );
}
