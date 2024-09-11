// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, useCallback } from 'react';

import type { LocalizerType } from '../../types/Util';
import { formatFileSize } from '../../util/formatFileSize';
import { TitlebarDragArea } from '../TitlebarDragArea';
import { ProgressBar } from '../ProgressBar';
import { ConfirmationDialog } from '../ConfirmationDialog';
import { InstallScreenSignalLogo } from './InstallScreenSignalLogo';

// We can't always use destructuring assignment because of the complexity of this props
//   type.

export type PropsType = Readonly<{
  i18n: LocalizerType;
  currentBytes?: number;
  totalBytes?: number;
  onCancel: () => void;
}>;

export function InstallScreenBackupImportStep({
  i18n,
  currentBytes,
  totalBytes,
  onCancel,
}: PropsType): JSX.Element {
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);

  const confirmCancel = useCallback(() => {
    setIsConfirmingCancel(true);
  }, []);

  const abortCancel = useCallback(() => {
    setIsConfirmingCancel(false);
  }, []);

  const onCancelWrap = useCallback(() => {
    onCancel();
    setIsConfirmingCancel(false);
  }, [onCancel]);

  let percentage = 0;
  let progress: JSX.Element;
  let isCancelPossible = true;
  if (currentBytes != null && totalBytes != null) {
    isCancelPossible = currentBytes !== totalBytes;

    percentage = Math.max(0, Math.min(1, currentBytes / totalBytes));
    if (percentage > 0 && percentage <= 0.01) {
      percentage = 0.01;
    } else if (percentage >= 0.99 && percentage < 1) {
      percentage = 0.99;
    } else {
      percentage = Math.round(percentage * 100) / 100;
    }

    progress = (
      <>
        <ProgressBar fractionComplete={percentage} />
        <div className="InstallScreenBackupImportStep__progressbar-hint">
          {i18n('icu:BackupImportScreen__progressbar-hint', {
            currentSize: formatFileSize(currentBytes),
            totalSize: formatFileSize(totalBytes),
            fractionComplete: percentage,
          })}
        </div>
      </>
    );
  } else {
    progress = (
      <>
        <ProgressBar fractionComplete={0} />
        <div className="InstallScreenBackupImportStep__progressbar-hint">
          {i18n('icu:BackupImportScreen__progressbar-hint--preparing')}
        </div>
      </>
    );
  }
  return (
    <div className="InstallScreenBackupImportStep">
      <TitlebarDragArea />

      <InstallScreenSignalLogo />

      <div className="InstallScreenBackupImportStep__content">
        <h3 className="InstallScreenBackupImportStep__title">
          {i18n('icu:BackupImportScreen__title')}
        </h3>
        {progress}
        <div className="InstallScreenBackupImportStep__description">
          {i18n('icu:BackupImportScreen__description')}
        </div>
      </div>

      {isCancelPossible && (
        <button
          className="InstallScreenBackupImportStep__cancel"
          type="button"
          onClick={confirmCancel}
        >
          {i18n('icu:BackupImportScreen__cancel')}
        </button>
      )}

      {isConfirmingCancel && (
        <ConfirmationDialog
          dialogName="InstallScreenBackupImportStep.confirmCancel"
          title={i18n('icu:BackupImportScreen__cancel-confirmation__title')}
          cancelText={i18n(
            'icu:BackupImportScreen__cancel-confirmation__cancel'
          )}
          actions={[
            {
              action: onCancelWrap,
              style: 'negative',
              text: i18n(
                'icu:BackupImportScreen__cancel-confirmation__confirm'
              ),
            },
          ]}
          i18n={i18n}
          onClose={abortCancel}
        >
          {i18n('icu:BackupImportScreen__cancel-confirmation__body')}
        </ConfirmationDialog>
      )}
    </div>
  );
}
