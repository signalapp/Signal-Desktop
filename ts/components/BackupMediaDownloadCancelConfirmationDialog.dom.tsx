// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { ConfirmationDialog } from './ConfirmationDialog.dom.js';
import type { LocalizerType } from '../types/I18N.std.js';
import { I18n } from './I18n.dom.js';

const BACKUP_AND_RESTORE_SUPPORT_PAGE =
  'https://support.signal.org/hc/articles/360007059752-Backup-and-Restore-Messages';
export function BackupMediaDownloadCancelConfirmationDialog({
  i18n,
  handleConfirmCancel,
  handleDialogClose,
}: {
  i18n: LocalizerType;
  handleConfirmCancel: VoidFunction;
  handleDialogClose: VoidFunction;
}): JSX.Element | null {
  const learnMoreLink = (parts: Array<string | JSX.Element>) => (
    <a href={BACKUP_AND_RESTORE_SUPPORT_PAGE} rel="noreferrer" target="_blank">
      {parts}
    </a>
  );
  return (
    <ConfirmationDialog
      moduleClassName="BackupMediaDownloadCancelConfirmation"
      dialogName="BackupMediaDownloadCancelConfirmation"
      cancelText={i18n(
        'icu:BackupMediaDownloadCancelConfirmation__button-continue'
      )}
      actions={[
        {
          text: i18n(
            'icu:BackupMediaDownloadCancelConfirmation__button-confirm-cancel'
          ),
          action: handleConfirmCancel,
          style: 'negative',
        },
      ]}
      i18n={i18n}
      onClose={handleDialogClose}
      title={i18n('icu:BackupMediaDownloadCancelConfirmation__title')}
    >
      <I18n
        id="icu:BackupMediaDownloadCancelConfirmation__description"
        i18n={i18n}
        components={{
          learnMoreLink,
        }}
      />
    </ConfirmationDialog>
  );
}
