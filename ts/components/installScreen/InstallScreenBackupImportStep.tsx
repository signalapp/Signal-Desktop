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

export type PropsType = Readonly<
  {
    i18n: LocalizerType;

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
  } & (
    | {
        backupStep: InstallScreenBackupStep.WaitForBackup;
      }
    | {
        backupStep:
          | InstallScreenBackupStep.Download
          | InstallScreenBackupStep.Process;
        currentBytes: number;
        totalBytes: number;
      }
  )
>;

export function InstallScreenBackupImportStep(props: PropsType): JSX.Element {
  const {
    i18n,
    backupStep,
    error,
    onCancel,
    onRetry,
    onRestartLink,
    updates,
    currentVersion,
    OS,
    startUpdate,
    forceUpdate,
  } = props;

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

  const onRetryWrap = useCallback(() => {
    onRetry();
    setIsConfirmingCancel(false);
  }, [onRetry]);

  const learnMoreLink = (parts: Array<string | JSX.Element>) => (
    <a href={SYNCING_MESSAGES_SECURITY_URL} rel="noreferrer" target="_blank">
      {parts}
    </a>
  );

  let errorElem: JSX.Element | undefined;
  if (error == null || error === InstallScreenBackupError.Canceled) {
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
        onClose={confirmCancel}
        OS={OS}
      />
    );
  } else if (error === InstallScreenBackupError.Retriable) {
    if (!isConfirmingCancel) {
      errorElem = (
        <ConfirmationDialog
          dialogName="InstallScreenBackupImportStep.error"
          title={i18n('icu:BackupImportScreen__error__title')}
          cancelText={i18n(
            'icu:BackupImportScreen__cancel-confirmation__confirm'
          )}
          actions={[
            {
              action: onRetryWrap,
              style: 'affirmative',
              text: i18n('icu:BackupImportScreen__error__confirm'),
            },
          ]}
          i18n={i18n}
          onClose={confirmCancel}
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

  const isCanceled = error === InstallScreenBackupError.Canceled;
  let cancelButton: JSX.Element | undefined;
  if (
    !isCanceled &&
    (backupStep === InstallScreenBackupStep.Download ||
      backupStep === InstallScreenBackupStep.Process)
  ) {
    cancelButton = (
      <button
        className="InstallScreenBackupImportStep__cancel"
        type="button"
        onClick={confirmCancel}
      >
        {i18n('icu:BackupImportScreen__cancel')}
      </button>
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
        <ProgressBarAndDescription {...props} isCanceled={isCanceled} />
        {!isCanceled && (
          <div className="InstallScreenBackupImportStep__description">
            {i18n('icu:BackupImportScreen__description')}
          </div>
        )}
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

        {cancelButton}
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

      {errorElem}
    </div>
  );
}

type ProgressBarPropsType = Readonly<
  {
    i18n: LocalizerType;
    isCanceled: boolean;
  } & (
    | {
        backupStep: InstallScreenBackupStep.WaitForBackup;
      }
    | {
        backupStep:
          | InstallScreenBackupStep.Download
          | InstallScreenBackupStep.Process;
        currentBytes: number;
        totalBytes: number;
      }
  )
>;

function ProgressBarAndDescription(props: ProgressBarPropsType): JSX.Element {
  const { backupStep, i18n, isCanceled } = props;
  if (backupStep === InstallScreenBackupStep.WaitForBackup) {
    return (
      <>
        <ProgressBar
          fractionComplete={null}
          isRTL={i18n.getLocaleDirection() === 'rtl'}
        />
        <div className="InstallScreenBackupImportStep__progressbar-hint">
          {i18n('icu:BackupImportScreen__progressbar-hint--preparing')}
        </div>
      </>
    );
  }

  const { currentBytes, totalBytes } = props;

  const fractionComplete = roundFractionForProgressBar(
    currentBytes / totalBytes
  );

  if (isCanceled) {
    return (
      <>
        <ProgressBar
          fractionComplete={fractionComplete}
          isRTL={i18n.getLocaleDirection() === 'rtl'}
        />
        <div className="InstallScreenBackupImportStep__progressbar-hint">
          {i18n('icu:BackupImportScreen__progressbar-hint--canceling')}
        </div>
      </>
    );
  }

  if (backupStep === InstallScreenBackupStep.Download) {
    return (
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
    // eslint-disable-next-line no-else-return
  } else if (backupStep === InstallScreenBackupStep.Process) {
    return (
      <>
        <ProgressBar
          fractionComplete={fractionComplete}
          isRTL={i18n.getLocaleDirection() === 'rtl'}
        />
        <div className="InstallScreenBackupImportStep__progressbar-hint">
          {i18n('icu:BackupImportScreen__progressbar-hint--processing')}
        </div>
      </>
    );
  } else {
    throw missingCaseError(backupStep);
  }
}
