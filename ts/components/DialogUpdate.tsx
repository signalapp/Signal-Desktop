// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { useCallback } from 'react';
import { isBeta } from '../util/version';
import { DialogType } from '../types/Dialogs';
import type { LocalizerType } from '../types/Util';
import { PRODUCTION_DOWNLOAD_URL, BETA_DOWNLOAD_URL } from '../types/support';
import { I18n } from './I18n';
import { LeftPaneDialog } from './LeftPaneDialog';
import type { WidthBreakpoint } from './_util';
import { formatFileSize } from '../util/formatFileSize';

function contactSupportLink(parts: ReactNode): JSX.Element {
  return (
    <a
      key="signal-support"
      href="https://support.signal.org/hc/en-us/requests/new?desktop"
      rel="noreferrer"
      target="_blank"
    >
      {parts}
    </a>
  );
}

export type PropsType = {
  containerWidthBreakpoint: WidthBreakpoint;
  dialogType: DialogType;
  dismissDialog: () => void;
  downloadSize?: number;
  downloadedSize?: number;
  i18n: LocalizerType;
  snoozeUpdate: () => void;
  startUpdate: () => void;
  version?: string;
  currentVersion: string;
};

export function DialogUpdate({
  containerWidthBreakpoint,
  dialogType,
  dismissDialog,
  downloadSize,
  downloadedSize,
  i18n,
  snoozeUpdate,
  startUpdate,
  version,
  currentVersion,
}: PropsType): JSX.Element | null {
  const retryUpdateButton = useCallback(
    (parts: ReactNode): JSX.Element => {
      return (
        <button
          className="LeftPaneDialog__retry"
          key="signal-retry"
          onClick={startUpdate}
          type="button"
        >
          {parts}
        </button>
      );
    },
    [startUpdate]
  );

  if (dialogType === DialogType.Cannot_Update) {
    const url = isBeta(currentVersion)
      ? BETA_DOWNLOAD_URL
      : PRODUCTION_DOWNLOAD_URL;
    return (
      <LeftPaneDialog
        containerWidthBreakpoint={containerWidthBreakpoint}
        type="warning"
        title={i18n('icu:cannotUpdate')}
      >
        <span>
          <I18n
            components={{
              retryUpdateButton,
              url: (
                <a
                  key="signal-download"
                  href={url}
                  rel="noreferrer"
                  target="_blank"
                >
                  {url}
                </a>
              ),
              contactSupportLink,
            }}
            i18n={i18n}
            id="icu:cannotUpdateDetail-v2"
          />
        </span>
      </LeftPaneDialog>
    );
  }

  if (dialogType === DialogType.Cannot_Update_Require_Manual) {
    const url = isBeta(currentVersion)
      ? BETA_DOWNLOAD_URL
      : PRODUCTION_DOWNLOAD_URL;
    return (
      <LeftPaneDialog
        containerWidthBreakpoint={containerWidthBreakpoint}
        type="warning"
        title={i18n('icu:cannotUpdate')}
      >
        <span>
          <I18n
            components={{
              url: (
                <a
                  key="signal-download"
                  href={url}
                  rel="noreferrer"
                  target="_blank"
                >
                  {url}
                </a>
              ),
              contactSupportLink,
            }}
            i18n={i18n}
            id="icu:cannotUpdateRequireManualDetail-v2"
          />
        </span>
      </LeftPaneDialog>
    );
  }

  if (dialogType === DialogType.MacOS_Read_Only) {
    return (
      <LeftPaneDialog
        closeLabel={i18n('icu:close')}
        containerWidthBreakpoint={containerWidthBreakpoint}
        hasXButton
        onClose={dismissDialog}
        title={i18n('icu:cannotUpdate')}
        type="warning"
      >
        <span>
          <I18n
            components={{
              app: <strong key="app">Signal.app</strong>,
              folder: <strong key="folder">/Applications</strong>,
            }}
            i18n={i18n}
            id="icu:readOnlyVolume"
          />
        </span>
      </LeftPaneDialog>
    );
  }

  if (dialogType === DialogType.UnsupportedOS) {
    // Displayed as UnsupportedOSDialog in LeftPane
    return null;
  }

  const versionTitle = version
    ? i18n('icu:DialogUpdate--version-available', {
        version,
      })
    : undefined;

  if (dialogType === DialogType.Downloading) {
    const width = Math.ceil(
      ((downloadedSize || 1) / (downloadSize || 1)) * 100
    );

    return (
      <LeftPaneDialog
        containerWidthBreakpoint={containerWidthBreakpoint}
        icon="update"
        title={i18n('icu:DialogUpdate__downloading')}
        hoverText={versionTitle}
      >
        <div className="LeftPaneDialog__progress--container">
          <div
            className="LeftPaneDialog__progress--bar"
            style={{ transform: `translateX(${width - 100}%)` }}
          />
        </div>
      </LeftPaneDialog>
    );
  }

  let title = i18n('icu:autoUpdateNewVersionTitle');

  if (
    downloadSize &&
    (dialogType === DialogType.DownloadReady ||
      dialogType === DialogType.FullDownloadReady)
  ) {
    title += ` (${formatFileSize(downloadSize)})`;
  }

  let clickLabel = i18n('icu:autoUpdateNewVersionMessage');
  let type: 'warning' | undefined;
  if (dialogType === DialogType.DownloadReady) {
    clickLabel = i18n('icu:downloadNewVersionMessage');
  } else if (dialogType === DialogType.FullDownloadReady) {
    clickLabel = i18n('icu:downloadFullNewVersionMessage');
    type = 'warning';
  } else if (dialogType === DialogType.DownloadedUpdate) {
    title = i18n('icu:DialogUpdate__downloaded');
  }

  return (
    <LeftPaneDialog
      containerWidthBreakpoint={containerWidthBreakpoint}
      icon="update"
      type={type}
      title={title}
      hoverText={versionTitle}
      hasAction
      onClick={startUpdate}
      clickLabel={clickLabel}
      hasXButton
      onClose={snoozeUpdate}
      closeLabel={i18n('icu:autoUpdateIgnoreButtonLabel')}
    />
  );
}
