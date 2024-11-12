// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { noop } from 'lodash';

import { DialogType } from '../../types/Dialogs';
import { InstallScreenStep } from '../../types/InstallScreen';
import type { LocalizerType } from '../../types/Util';
import {
  PRODUCTION_DOWNLOAD_URL,
  BETA_DOWNLOAD_URL,
  UNSUPPORTED_OS_URL,
} from '../../types/support';
import type { UpdatesStateType } from '../../state/ducks/updates';
import { isBeta } from '../../util/version';
import { missingCaseError } from '../../util/missingCaseError';
import { roundFractionForProgressBar } from '../../util/numbers';
import { ConfirmationDialog } from '../ConfirmationDialog';
import { Modal } from '../Modal';
import { I18n } from '../I18n';
import { formatFileSize } from '../../util/formatFileSize';

export type PropsType = UpdatesStateType &
  Readonly<{
    i18n: LocalizerType;
    step: InstallScreenStep;
    forceUpdate: () => void;
    startUpdate: () => void;
    currentVersion: string;
    OS: string;
    onClose?: () => void;
  }>;

export function InstallScreenUpdateDialog({
  i18n,
  step,
  dialogType,
  isCheckingForUpdates,
  downloadSize,
  downloadedSize,
  forceUpdate,
  startUpdate,
  currentVersion,
  OS,
  onClose = noop,
}: PropsType): JSX.Element | null {
  const learnMoreLink = (parts: Array<string | JSX.Element>) => (
    <a
      key="signal-support"
      href={UNSUPPORTED_OS_URL}
      rel="noreferrer"
      target="_blank"
    >
      {parts}
    </a>
  );

  const dialogName = `InstallScreenUpdateDialog.${dialogType}`;

  if (dialogType === DialogType.None) {
    if (step === InstallScreenStep.BackupImport) {
      if (isCheckingForUpdates) {
        return <DownloadingModal i18n={i18n} width={0} />;
      }

      return (
        <ConfirmationDialog
          i18n={i18n}
          dialogName={dialogName}
          noMouseClose
          onClose={onClose}
          noDefaultCancelButton
          actions={[
            {
              id: 'ok',
              text: i18n(
                'icu:InstallScreenUpdateDialog--update-required__action-update'
              ),
              action: forceUpdate,
              style: 'affirmative',
              autoClose: false,
            },
          ]}
          title={i18n('icu:InstallScreenUpdateDialog--update-required__title')}
        >
          {i18n('icu:InstallScreenUpdateDialog--update-required__body')}
        </ConfirmationDialog>
      );
    }

    return null;
  }

  if (dialogType === DialogType.UnsupportedOS) {
    return (
      <Modal
        i18n={i18n}
        modalName={dialogName}
        noMouseClose
        title={i18n('icu:InstallScreenUpdateDialog--unsupported-os__title')}
      >
        <I18n
          id="icu:UnsupportedOSErrorDialog__body"
          i18n={i18n}
          components={{
            OS,
            learnMoreLink,
          }}
        />
      </Modal>
    );
  }

  if (
    dialogType === DialogType.AutoUpdate ||
    // Manual update with an action button
    dialogType === DialogType.DownloadReady ||
    dialogType === DialogType.FullDownloadReady ||
    dialogType === DialogType.DownloadedUpdate
  ) {
    let title = i18n('icu:autoUpdateNewVersionTitle');
    let actionText: string | JSX.Element = i18n(
      'icu:autoUpdateRestartButtonLabel'
    );
    let bodyText = i18n('icu:InstallScreenUpdateDialog--auto-update__body');
    if (
      dialogType === DialogType.DownloadReady ||
      dialogType === DialogType.FullDownloadReady
    ) {
      actionText = (
        <I18n
          id="icu:InstallScreenUpdateDialog--manual-update__action"
          i18n={i18n}
          components={{
            downloadSize: (
              <span className="InstallScreenUpdateDialog__download-size">
                ({formatFileSize(downloadSize ?? 0)})
              </span>
            ),
          }}
        />
      );
    }

    if (dialogType === DialogType.DownloadedUpdate) {
      title = i18n('icu:DialogUpdate__downloaded');
      bodyText = i18n('icu:InstallScreenUpdateDialog--downloaded__body');
    }

    return (
      <ConfirmationDialog
        i18n={i18n}
        dialogName={dialogName}
        title={title}
        noMouseClose
        noDefaultCancelButton
        actions={[
          {
            id: 'ok',
            text: actionText,
            action: startUpdate,
            style: 'affirmative',
            autoClose: false,
          },
        ]}
        onClose={onClose}
      >
        {bodyText}
      </ConfirmationDialog>
    );
  }

  if (dialogType === DialogType.Downloading) {
    const fractionComplete = roundFractionForProgressBar(
      (downloadedSize || 0) / (downloadSize || 1)
    );
    return <DownloadingModal i18n={i18n} width={fractionComplete * 100} />;
  }

  if (
    dialogType === DialogType.Cannot_Update ||
    dialogType === DialogType.Cannot_Update_Require_Manual
  ) {
    const url = isBeta(currentVersion)
      ? BETA_DOWNLOAD_URL
      : PRODUCTION_DOWNLOAD_URL;
    const title = i18n('icu:cannotUpdate');
    const body = (
      <I18n
        i18n={i18n}
        id="icu:InstallScreenUpdateDialog--cannot-update__body"
        components={{
          downloadUrl: (
            <a href={url} target="_blank" rel="noreferrer">
              {url}
            </a>
          ),
        }}
      />
    );

    if (dialogType === DialogType.Cannot_Update) {
      return (
        <ConfirmationDialog
          i18n={i18n}
          dialogName={dialogName}
          moduleClassName="InstallScreenUpdateDialog"
          title={title}
          noMouseClose
          noDefaultCancelButton
          actions={[
            {
              text: i18n('icu:autoUpdateRetry'),
              action: startUpdate,
              style: 'affirmative',
              autoClose: false,
            },
          ]}
          onClose={onClose}
        >
          {body}
        </ConfirmationDialog>
      );
    }

    return (
      <Modal
        i18n={i18n}
        modalName={dialogName}
        noMouseClose
        title={title}
        moduleClassName="InstallScreenUpdateDialog"
      >
        {body}
      </Modal>
    );
  }

  if (dialogType === DialogType.MacOS_Read_Only) {
    // No focus trap, because there are no focusable elements.
    return (
      <Modal
        i18n={i18n}
        modalName={dialogName}
        noMouseClose
        useFocusTrap={false}
        title={i18n('icu:cannotUpdate')}
      >
        <I18n
          components={{
            app: <strong key="app">Signal.app</strong>,
            folder: <strong key="folder">/Applications</strong>,
          }}
          i18n={i18n}
          id="icu:readOnlyVolume"
        />
      </Modal>
    );
  }

  throw missingCaseError(dialogType);
}

export function DownloadingModal({
  i18n,
  width,
}: {
  i18n: LocalizerType;
  width: number;
}): JSX.Element {
  // Focus trap can't be used because there are no elements that can be
  // focused within the modal.
  return (
    <Modal
      i18n={i18n}
      modalName="InstallScreenUpdateDialog.Downloading"
      noMouseClose
      useFocusTrap={false}
      title={i18n('icu:DialogUpdate__downloading')}
    >
      <div className="InstallScreenUpdateDialog__progress--container">
        <div
          className="InstallScreenUpdateDialog__progress--bar"
          style={{ transform: `translateX(${width - 100}%)` }}
        />
      </div>
    </Modal>
  );
}
