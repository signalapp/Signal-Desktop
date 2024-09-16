// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { ConfirmationDialog } from './ConfirmationDialog';
import type { LocalizerType } from '../types/I18N';

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
      {i18n('icu:BackupMediaDownloadCancelConfirmation__description')}
    </ConfirmationDialog>
  );
}
