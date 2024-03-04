// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { noop } from 'lodash';
import formatFileSize from 'filesize';

import { DialogType } from '../../types/Dialogs';
import type { LocalizerType } from '../../types/Util';
import {
  PRODUCTION_DOWNLOAD_URL,
  BETA_DOWNLOAD_URL,
  UNSUPPORTED_OS_URL,
} from '../../types/support';
import type { UpdatesStateType } from '../../state/ducks/updates';
import { isBeta } from '../../util/version';
import { ConfirmationDialog } from '../ConfirmationDialog';
import { Modal } from '../Modal';
import { Intl } from '../Intl';

export type PropsType = UpdatesStateType &
  Readonly<{
    i18n: LocalizerType;
    startUpdate: () => void;
    currentVersion: string;
    OS: string;
  }>;

export function InstallScreenUpdateDialog({
  i18n,
  dialogType,
  downloadSize,
  downloadedSize,
  startUpdate,
  currentVersion,
  OS,
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

  if (dialogType === DialogType.UnsupportedOS) {
    return (
      <Modal
        i18n={i18n}
        modalName={dialogName}
        noMouseClose
        title={i18n('icu:InstallScreenUpdateDialog--unsupported-os__title')}
      >
        <Intl
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
        <Intl
          id="icu:InstallScreenUpdateDialog--manual-update__action"
          i18n={i18n}
          components={{
            downloadSize: (
              <span className="InstallScreenUpdateDialog__download-size">
                ({formatFileSize(downloadSize ?? 0, { round: 0 })})
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
        onClose={noop}
      >
        {bodyText}
      </ConfirmationDialog>
    );
  }

  if (dialogType === DialogType.Downloading) {
    // Focus trap can't be used because there are no elements that can be
    // focused within the modal.
    const width = Math.ceil(
      ((downloadedSize || 1) / (downloadSize || 1)) * 100
    );
    return (
      <Modal
        i18n={i18n}
        modalName={dialogName}
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

  if (
    dialogType === DialogType.Cannot_Update ||
    dialogType === DialogType.Cannot_Update_Require_Manual
  ) {
    const url = isBeta(currentVersion)
      ? BETA_DOWNLOAD_URL
      : PRODUCTION_DOWNLOAD_URL;
    const title = i18n('icu:cannotUpdate');
    const body = (
      <Intl
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
          noDefaultCancelButton
          actions={[
            {
              text: i18n('icu:autoUpdateRetry'),
              action: startUpdate,
              style: 'affirmative',
              autoClose: false,
            },
          ]}
          onClose={noop}
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
        <Intl
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

  return null;
}
