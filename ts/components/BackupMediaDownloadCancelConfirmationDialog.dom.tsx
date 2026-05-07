// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';
import type { LocalizerType } from '../types/I18N.std.ts';
import { I18n } from './I18n.dom.tsx';
import { AxoConfirmDialog } from '../axo/AxoConfirmDialog.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';

const BACKUP_AND_RESTORE_SUPPORT_PAGE =
  'https://support.signal.org/hc/articles/360007059752-Backup-and-Restore-Messages';

const learnMoreLink = (parts: Array<string | JSX.Element>) => (
  <a
    href={BACKUP_AND_RESTORE_SUPPORT_PAGE}
    rel="noreferrer"
    target="_blank"
    className={tw('no-underline')}
  >
    {parts}
  </a>
);

export function BackupMediaDownloadCancelConfirmationDialog({
  i18n,
  handleConfirmCancel,
  handleDialogClose,
}: {
  i18n: LocalizerType;
  handleConfirmCancel: VoidFunction;
  handleDialogClose: VoidFunction;
}): JSX.Element | null {
  return (
    <AxoConfirmDialog.Root
      open
      onOpenChange={handleDialogClose}
      title={i18n('icu:BackupMediaDownloadCancelConfirmation__title')}
      description={
        <I18n
          id="icu:BackupMediaDownloadCancelConfirmation__description"
          i18n={i18n}
          components={{
            learnMoreLink,
          }}
        />
      }
    >
      <AxoConfirmDialog.Cancel />
      <AxoConfirmDialog.Action
        variant="destructive"
        onClick={handleConfirmCancel}
      >
        {i18n(
          'icu:BackupMediaDownloadCancelConfirmation__button-confirm-cancel'
        )}
      </AxoConfirmDialog.Action>
    </AxoConfirmDialog.Root>
  );
}
