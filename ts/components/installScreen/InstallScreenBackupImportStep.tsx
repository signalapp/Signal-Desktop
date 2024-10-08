// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, useCallback } from 'react';

import type { LocalizerType } from '../../types/Util';
import { formatFileSize } from '../../util/formatFileSize';
import { TitlebarDragArea } from '../TitlebarDragArea';
import { ProgressBar } from '../ProgressBar';
import { ConfirmationDialog } from '../ConfirmationDialog';
import { InstallScreenSignalLogo } from './InstallScreenSignalLogo';
import { roundFractionForProgressBar } from '../../util/numbers';

// We can't always use destructuring assignment because of the complexity of this props
//   type.

export type PropsType = Readonly<{
  i18n: LocalizerType;
  currentBytes?: number;
  totalBytes?: number;
  hasError?: boolean;
  onCancel: () => void;
  onRetry: () => void;
}>;

export function InstallScreenBackupImportStep({
  i18n,
  currentBytes,
  totalBytes,
  hasError,
  onCancel,
  onRetry,
}: PropsType): JSX.Element {
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);
  const [isConfirmingSkip, setIsConfirmingSkip] = useState(false);

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

  const confirmSkip = useCallback(() => {
    setIsConfirmingSkip(true);
  }, []);

  const abortSkip = useCallback(() => {
    setIsConfirmingSkip(false);
  }, []);

  const onSkipWrap = useCallback(() => {
    onCancel();
    setIsConfirmingSkip(false);
  }, [onCancel]);

  const onRetryWrap = useCallback(() => {
    onRetry();
    setIsConfirmingSkip(false);
  }, [onRetry]);

  let progress: JSX.Element;
  let isCancelPossible = true;
  if (currentBytes != null && totalBytes != null) {
    isCancelPossible = currentBytes !== totalBytes;

    const fractionComplete = roundFractionForProgressBar(
      currentBytes / totalBytes
    );

    progress = (
      <>
        <ProgressBar
          fractionComplete={fractionComplete}
          isRTL={i18n.getLocaleDirection() === 'rtl'}
        />
        <div className="InstallScreenBackupImportStep__progressbar-hint">
          {i18n('icu:BackupImportScreen__progressbar-hint', {
            currentSize: formatFileSize(currentBytes),
            totalSize: formatFileSize(totalBytes),
            fractionComplete,
          })}
        </div>
      </>
    );
  } else {
    progress = (
      <>
        <ProgressBar
          fractionComplete={0}
          isRTL={i18n.getLocaleDirection() === 'rtl'}
        />
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

      {isConfirmingSkip && (
        <ConfirmationDialog
          dialogName="InstallScreenBackupImportStep.confirmSkip"
          title={i18n('icu:BackupImportScreen__skip-confirmation__title')}
          cancelText={i18n('icu:BackupImportScreen__skip-confirmation__cancel')}
          actions={[
            {
              action: onSkipWrap,
              style: 'affirmative',
              text: i18n('icu:BackupImportScreen__skip'),
            },
          ]}
          i18n={i18n}
          onClose={abortSkip}
        >
          {i18n('icu:BackupImportScreen__skip-confirmation__body')}
        </ConfirmationDialog>
      )}

      {hasError && !isConfirmingSkip && (
        <ConfirmationDialog
          dialogName="InstallScreenBackupImportStep.error"
          title={i18n('icu:BackupImportScreen__error__title')}
          cancelText={i18n('icu:BackupImportScreen__skip')}
          actions={[
            {
              action: onRetryWrap,
              style: 'affirmative',
              text: i18n('icu:BackupImportScreen__error__confirm'),
            },
          ]}
          i18n={i18n}
          onClose={confirmSkip}
        >
          {i18n('icu:BackupImportScreen__error__body')}
        </ConfirmationDialog>
      )}
    </div>
  );
}
