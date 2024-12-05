// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, useCallback } from 'react';

import type { LocalizerType } from '../../types/Util';
import type { UpdatesStateType } from '../../state/ducks/updates';
import {
  InstallScreenStep,
  InstallScreenBackupStep,
  InstallScreenBackupError,
} from '../../types/InstallScreen';
import { formatFileSize } from '../../util/formatFileSize';
import { TitlebarDragArea } from '../TitlebarDragArea';
import { ProgressBar } from '../ProgressBar';
import { ConfirmationDialog } from '../ConfirmationDialog';
import { InstallScreenSignalLogo } from './InstallScreenSignalLogo';
import { roundFractionForProgressBar } from '../../util/numbers';
import { missingCaseError } from '../../util/missingCaseError';
import { SYNCING_MESSAGES_SECURITY_URL } from '../../types/support';
import { I18n } from '../I18n';
import { InstallScreenUpdateDialog } from './InstallScreenUpdateDialog';

// We can't always use destructuring assignment because of the complexity of this props
//   type.

export type PropsType = Readonly<{
  i18n: LocalizerType;
  backupStep: InstallScreenBackupStep;
  currentBytes?: number;
  totalBytes?: number;
  error?: InstallScreenBackupError;
  onCancel: () => void;
  onRetry: () => void;
  onRestartLink: () => void;

  // Updater UI
  updates: UpdatesStateType;
  currentVersion: string;
  OS: string;
  startUpdate: () => void;
  forceUpdate: () => void;
}>;

export function InstallScreenBackupImportStep({
  i18n,
  backupStep,
  currentBytes,
  totalBytes,
  error,
  onCancel,
  onRetry,
  onRestartLink,

  updates,
  currentVersion,
  OS,
  startUpdate,
  forceUpdate,
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
  if (currentBytes != null && totalBytes != null) {
    const fractionComplete = roundFractionForProgressBar(
      currentBytes / totalBytes
    );

    let hint: string;
    if (backupStep === InstallScreenBackupStep.Download) {
      hint = i18n('icu:BackupImportScreen__progressbar-hint', {
        currentSize: formatFileSize(currentBytes),
        totalSize: formatFileSize(totalBytes),
        fractionComplete,
      });
    } else if (backupStep === InstallScreenBackupStep.Process) {
      hint = i18n('icu:BackupImportScreen__progressbar-hint--processing');
    } else {
      throw missingCaseError(backupStep);
    }

    progress = (
      <>
        <ProgressBar
          key={backupStep}
          fractionComplete={fractionComplete}
          isRTL={i18n.getLocaleDirection() === 'rtl'}
        />
        <div className="InstallScreenBackupImportStep__progressbar-hint">
          {hint}
        </div>
      </>
    );
  } else {
    progress = (
      <>
        <ProgressBar
          key={backupStep}
          fractionComplete={0}
          isRTL={i18n.getLocaleDirection() === 'rtl'}
        />
        <div className="InstallScreenBackupImportStep__progressbar-hint">
          {i18n('icu:BackupImportScreen__progressbar-hint--preparing')}
        </div>
      </>
    );
  }

  const learnMoreLink = (parts: Array<string | JSX.Element>) => (
    <a href={SYNCING_MESSAGES_SECURITY_URL} rel="noreferrer" target="_blank">
      {parts}
    </a>
  );

  let errorElem: JSX.Element | undefined;
  if (error == null) {
    // no-op
  } else if (error === InstallScreenBackupError.UnsupportedVersion) {
    errorElem = (
      <InstallScreenUpdateDialog
        i18n={i18n}
        {...updates}
        step={InstallScreenStep.BackupImport}
        startUpdate={startUpdate}
        forceUpdate={forceUpdate}
        currentVersion={currentVersion}
        onClose={confirmSkip}
        OS={OS}
      />
    );
  } else if (error === InstallScreenBackupError.Retriable) {
    if (!isConfirmingSkip) {
      errorElem = (
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
      );
    }
  } else if (error === InstallScreenBackupError.Fatal) {
    errorElem = (
      <ConfirmationDialog
        dialogName="InstallScreenBackupImportStep.error"
        title={i18n('icu:BackupImportScreen__error__title')}
        actions={[
          {
            action: onRestartLink,
            style: 'affirmative',
            text: i18n('icu:BackupImportScreen__error__confirm'),
          },
        ]}
        i18n={i18n}
        onClose={() => null}
        noMouseClose
        noDefaultCancelButton
        noEscapeClose
      >
        {i18n('icu:BackupImportScreen__error-fatal__body')}
      </ConfirmationDialog>
    );
  } else {
    throw missingCaseError(error);
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
      <div className="InstallScreenBackupImportStep__footer">
        <div className="InstallScreenBackupImportStep__security">
          <div className="InstallScreenBackupImportStep__security--icon" />
          <div className="InstallScreenBackupImportStep__security--description">
            <I18n
              i18n={i18n}
              id="icu:BackupImportScreen__security-description"
              components={{ learnMoreLink }}
            />
          </div>
        </div>

        {backupStep === InstallScreenBackupStep.Download && (
          <button
            className="InstallScreenBackupImportStep__cancel"
            type="button"
            onClick={confirmCancel}
          >
            {i18n('icu:BackupImportScreen__cancel')}
          </button>
        )}
      </div>

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

      {errorElem}
    </div>
  );
}
