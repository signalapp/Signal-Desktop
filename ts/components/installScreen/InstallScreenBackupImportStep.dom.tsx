// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState, useCallback, type JSX } from 'react';

import type { LocalizerType } from '../../types/Util.std.ts';
import type { UpdatesStateType } from '../../state/ducks/updates.preload.ts';
import {
  InstallScreenStep,
  InstallScreenBackupStep,
  InstallScreenBackupError,
} from '../../types/InstallScreen.std.ts';
import { formatFileSize } from '../../util/formatFileSize.std.ts';
import { TitlebarDragArea } from '../TitlebarDragArea.dom.tsx';
import { ProgressBar } from '../ProgressBar.dom.tsx';
import { InstallScreenSignalLogo } from './InstallScreenSignalLogo.dom.tsx';
import { roundFractionForProgressBar } from '../../util/numbers.std.ts';
import { missingCaseError } from '../../util/missingCaseError.std.ts';
import { SYNCING_MESSAGES_SECURITY_URL } from '../../types/support.std.ts';
import { I18n } from '../I18n.dom.tsx';
import { InstallScreenUpdateDialog } from './InstallScreenUpdateDialog.dom.tsx';
import { AxoConfirmDialog } from '../../axo/AxoConfirmDialog.dom.tsx';

// We can't always use destructuring assignment because of the complexity of this props
//   type.

export type PropsType = Readonly<
  {
    i18n: LocalizerType;

    error?: InstallScreenBackupError;
    onCancel: () => void;
    onRetry: () => void;

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
        <AxoConfirmDialog.Root
          open
          onOpenChange={confirmCancel}
          title={i18n('icu:BackupImportScreen__error__title')}
          description={i18n('icu:BackupImportScreen__error__body')}
        >
          <AxoConfirmDialog.Cancel>
            {i18n('icu:BackupImportScreen__cancel-confirmation__confirm')}
          </AxoConfirmDialog.Cancel>
          <AxoConfirmDialog.Action variant="primary" onClick={onRetryWrap}>
            {i18n('icu:BackupImportScreen__error__confirm')}
          </AxoConfirmDialog.Action>
          .
        </AxoConfirmDialog.Root>
      );
    }
  } else if (error === InstallScreenBackupError.Fatal) {
    errorElem = (
      <AxoConfirmDialog.Root
        open
        onOpenChange={() => null}
        title={i18n('icu:BackupImportScreen__error__title')}
        description={i18n('icu:BackupImportScreen__error-fatal__body')}
      >
        <AxoConfirmDialog.Action variant="primary" onClick={onCancel}>
          {i18n('icu:BackupImportScreen__error__confirm')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>
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

      <AxoConfirmDialog.Root
        open={isConfirmingCancel}
        onOpenChange={setIsConfirmingCancel}
        title={i18n('icu:BackupImportScreen__cancel-confirmation__title')}
        description={i18n('icu:BackupImportScreen__cancel-confirmation__body')}
      >
        <AxoConfirmDialog.Cancel>
          {i18n('icu:BackupImportScreen__cancel-confirmation__cancel')}
        </AxoConfirmDialog.Cancel>
        <AxoConfirmDialog.Action variant="destructive" onClick={onCancelWrap}>
          {i18n('icu:BackupImportScreen__cancel-confirmation__confirm')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>

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

  if (isCanceled) {
    return (
      <>
        <ProgressBar
          fractionComplete={null}
          isRTL={i18n.getLocaleDirection() === 'rtl'}
        />
        <div className="InstallScreenBackupImportStep__progressbar-hint">
          {i18n('icu:BackupImportScreen__progressbar-hint--canceling')}
        </div>
      </>
    );
  }

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
    // oxlint-disable-next-line no-else-return
  } else {
    throw missingCaseError(backupStep);
  }
}
