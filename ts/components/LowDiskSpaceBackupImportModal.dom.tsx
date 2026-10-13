// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import type { LocalizerType } from '../types/Util.std.ts';
import { formatFileSize } from '../util/formatFileSize.std.ts';
import { AxoAlertDialog } from '../axo/AxoAlertDialog.dom.tsx';
import { AxoSymbol } from '../axo/AxoSymbol.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';

export type LowDiskSpaceBackupImportModalProps = Readonly<{
  bytesNeeded: number;
  i18n: LocalizerType;
  onClose: () => void;
}>;

export function LowDiskSpaceBackupImportModal(
  props: LowDiskSpaceBackupImportModalProps
): ReactNode {
  const { i18n } = props;
  return (
    <AxoAlertDialog.Root open onOpenChange={props.onClose}>
      <AxoAlertDialog.Content escape="cancel-is-noop">
        <AxoAlertDialog.Body>
          <div className={tw('flex justify-center text-warning')}>
            <div className={tw('size-fit rounded-full bg-warning-bright p-4')}>
              <AxoSymbol.Icon label={null} symbol="backup-error" size={36} />
            </div>
          </div>
          <AxoAlertDialog.Title>
            {i18n('icu:LowDiskSpaceBackupImportModal__title')}
          </AxoAlertDialog.Title>
          <AxoAlertDialog.Description>
            {i18n('icu:LowDiskSpaceBackupImportModal__description', {
              diskSpaceAmount: formatFileSize(props.bytesNeeded),
            })}
          </AxoAlertDialog.Description>
        </AxoAlertDialog.Body>
        <AxoAlertDialog.Footer>
          <AxoAlertDialog.Action variant="strong-primary">
            {i18n('icu:Confirmation--confirm')}
          </AxoAlertDialog.Action>
        </AxoAlertDialog.Footer>
      </AxoAlertDialog.Content>
    </AxoAlertDialog.Root>
  );
}
