// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import formatFileSize from 'filesize';

import { DialogType } from '../types/Dialogs';
import { Intl } from './Intl';
import { LocalizerType } from '../types/Util';

export type PropsType = {
  dialogType: DialogType;
  didSnooze: boolean;
  dismissDialog: () => void;
  downloadSize?: number;
  downloadedSize?: number;
  hasNetworkDialog: boolean;
  i18n: LocalizerType;
  showEventsCount: number;
  snoozeUpdate: () => void;
  startUpdate: () => void;
  version?: string;
};

export const DialogUpdate = ({
  dialogType,
  didSnooze,
  dismissDialog,
  downloadSize,
  downloadedSize,
  hasNetworkDialog,
  i18n,
  snoozeUpdate,
  startUpdate,
  version,
}: PropsType): JSX.Element | null => {
  if (hasNetworkDialog) {
    return null;
  }

  if (dialogType === DialogType.None) {
    return null;
  }

  if (didSnooze) {
    return null;
  }

  if (dialogType === DialogType.Cannot_Update) {
    return (
      <div className="LeftPaneDialog LeftPaneDialog--warning">
        <div className="LeftPaneDialog__message">
          <h3>{i18n('cannotUpdate')}</h3>
          <span>
            <Intl
              components={[
                <a
                  key="signal-download"
                  href="https://signal.org/download/"
                  rel="noreferrer"
                  target="_blank"
                >
                  https://signal.org/download/
                </a>,
              ]}
              i18n={i18n}
              id="cannotUpdateDetail"
            />
          </span>
        </div>
      </div>
    );
  }

  if (dialogType === DialogType.MacOS_Read_Only) {
    return (
      <div className="LeftPaneDialog LeftPaneDialog--warning">
        <div className="LeftPaneDialog__container">
          <div className="LeftPaneDialog__message">
            <h3>{i18n('cannotUpdate')}</h3>
            <span>
              <Intl
                components={{
                  app: <strong key="app">Signal.app</strong>,
                  folder: <strong key="folder">/Applications</strong>,
                }}
                i18n={i18n}
                id="readOnlyVolume"
              />
            </span>
          </div>
        </div>
        <div className="LeftPaneDialog__container-close">
          <button
            aria-label={i18n('close')}
            className="LeftPaneDialog__close-button"
            onClick={dismissDialog}
            tabIndex={0}
            type="button"
          />
        </div>
      </div>
    );
  }

  let size: string | undefined;
  if (
    downloadSize &&
    (dialogType === DialogType.DownloadReady ||
      dialogType === DialogType.Downloading)
  ) {
    size = `(${formatFileSize(downloadSize, { round: 0 })})`;
  }

  let updateSubText: JSX.Element;
  if (dialogType === DialogType.DownloadReady) {
    updateSubText = (
      <button
        className="LeftPaneDialog__action-text"
        onClick={startUpdate}
        type="button"
      >
        {i18n('downloadNewVersionMessage')}
      </button>
    );
  } else if (dialogType === DialogType.Downloading) {
    const width = Math.ceil(
      ((downloadedSize || 1) / (downloadSize || 1)) * 100
    );

    updateSubText = (
      <div className="LeftPaneDialog__progress--container">
        <div
          className="LeftPaneDialog__progress--bar"
          style={{ width: `${width}%` }}
        />
      </div>
    );
  } else {
    updateSubText = (
      <button
        className="LeftPaneDialog__action-text"
        onClick={startUpdate}
        type="button"
      >
        {i18n('autoUpdateNewVersionMessage')}
      </button>
    );
  }

  const versionTitle = version
    ? i18n('DialogUpdate--version-available', [version])
    : undefined;

  return (
    <div className="LeftPaneDialog" title={versionTitle}>
      <div className="LeftPaneDialog__container">
        <div className="LeftPaneDialog__icon LeftPaneDialog__icon--update" />
        <div className="LeftPaneDialog__message">
          <h3>
            {i18n('autoUpdateNewVersionTitle')} {size}
          </h3>
          {updateSubText}
        </div>
      </div>
      <div className="LeftPaneDialog__container-close">
        {dialogType !== DialogType.Downloading && (
          <button
            aria-label={i18n('close')}
            className="LeftPaneDialog__close-button"
            onClick={snoozeUpdate}
            tabIndex={0}
            type="button"
          />
        )}
      </div>
    </div>
  );
};
