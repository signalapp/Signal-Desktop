// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';

import type { LocalizerType } from '../types/Util.std.js';
import { formatFileSize } from '../util/formatFileSize.std.js';
import { SpinnerV2 } from './SpinnerV2.dom.js';
import { ContextMenu } from './ContextMenu.dom.js';
import { BackupMediaDownloadCancelConfirmationDialog } from './BackupMediaDownloadCancelConfirmationDialog.dom.js';
import { LeftPaneDialog } from './LeftPaneDialog.dom.js';
import { WidthBreakpoint } from './_util.std.js';

export type PropsType = Readonly<{
  i18n: LocalizerType;
  downloadedBytes: number;
  totalBytes: number;
  isIdle: boolean;
  isOnline: boolean;
  isPaused: boolean;
  widthBreakpoint: WidthBreakpoint;
  handleCancel: VoidFunction;
  handleClose: VoidFunction;
  handleResume: VoidFunction;
  handlePause: VoidFunction;
}>;

export function BackupMediaDownloadProgress({
  i18n,
  downloadedBytes,
  totalBytes,
  isIdle,
  isOnline,
  isPaused,
  handleCancel: handleConfirmedCancel,
  handleClose,
  handleResume,
  handlePause,
  widthBreakpoint,
}: PropsType): JSX.Element | null {
  const [isShowingCancelConfirmation, setIsShowingCancelConfirmation] =
    useState(false);

  if (totalBytes <= 0) {
    return null;
  }

  function handleCancel() {
    setIsShowingCancelConfirmation(true);
  }

  let content: JSX.Element | undefined;
  let icon: JSX.Element | undefined;

  const isCompleted = downloadedBytes === totalBytes;

  const actionButton =
    isCompleted || isIdle ? (
      <button
        type="button"
        onClick={handleClose}
        className="BackupMediaDownloadProgress__button-close"
        aria-label={i18n('icu:close')}
      />
    ) : (
      <ContextMenu
        i18n={i18n}
        menuOptions={[
          isPaused
            ? {
                label: i18n('icu:BackupMediaDownloadProgress__button-resume'),
                onClick: handleResume,
              }
            : {
                label: i18n('icu:BackupMediaDownloadProgress__button-pause'),
                onClick: handlePause,
              },
          {
            label: i18n('icu:BackupMediaDownloadProgress__button-cancel'),
            onClick: handleCancel,
          },
        ]}
        popperOptions={{
          placement: 'bottom-end',
          strategy: 'absolute',
        }}
        portalToRoot
      >
        {({ onClick }) => {
          return (
            <button
              type="button"
              onClick={onClick}
              className="BackupMediaDownloadProgress__button-more"
              aria-label={i18n('icu:BackupMediaDownloadProgress__button-more')}
            />
          );
        }}
      </ContextMenu>
    );

  if (isCompleted) {
    icon = (
      <div
        className="BackupMediaDownloadProgress__icon BackupMediaDownloadProgress__icon--complete"
        aria-label={i18n('icu:BackupMediaDownloadProgress__title-complete')}
      />
    );
    content = (
      <>
        <div className="BackupMediaDownloadProgress__title">
          {i18n('icu:BackupMediaDownloadProgress__title-complete')}
        </div>
        <div className="BackupMediaDownloadProgress__description">
          {formatFileSize(downloadedBytes)}
        </div>
      </>
    );
  } else if (isPaused) {
    content = (
      <>
        <div className="BackupMediaDownloadProgress__title">
          {i18n('icu:BackupMediaDownloadProgress__title-paused')}
        </div>
        {widthBreakpoint !== WidthBreakpoint.Narrow ? (
          <button
            type="button"
            onClick={handleResume}
            className="BackupMediaDownloadProgress__button"
            aria-label={i18n('icu:BackupMediaDownloadProgress__button-resume')}
          >
            {i18n('icu:BackupMediaDownloadProgress__button-resume')}
          </button>
        ) : null}
      </>
    );
    icon = (
      <div className="BackupMediaDownloadProgress__icon">
        <SpinnerV2
          size={24}
          strokeWidth={3}
          marginRatio={1}
          min={0}
          max={totalBytes}
          value={downloadedBytes}
          variant="brand"
          ariaLabel={i18n('icu:BackupMediaDownloadProgress__title-paused')}
        />
      </div>
    );
  } else if (isIdle) {
    icon = (
      <div
        className="BackupMediaDownloadProgress__icon BackupMediaDownloadProgress__icon--idle"
        aria-label={i18n('icu:BackupMediaDownloadProgress__description-idle')}
      />
    );
    content = (
      <>
        <div className="BackupMediaDownloadProgress__title">
          {i18n('icu:BackupMediaDownloadProgress__title-idle', {
            currentSize: formatFileSize(downloadedBytes),
            totalSize: formatFileSize(totalBytes),
          })}
        </div>
        <div className="BackupMediaDownloadProgress__description">
          {i18n('icu:BackupMediaDownloadProgress__description-idle')}
        </div>
      </>
    );
  } else if (!isOnline) {
    content = (
      <>
        <div className="BackupMediaDownloadProgress__title">
          {i18n('icu:BackupMediaDownloadProgress__title-offline')}
        </div>

        <div className="BackupMediaDownloadProgress__description">
          {i18n('icu:BackupMediaDownloadProgress__description-offline')}
        </div>
      </>
    );
    icon = (
      <div className="BackupMediaDownloadProgress__icon">
        <SpinnerV2
          size={24}
          strokeWidth={3}
          marginRatio={1}
          min={0}
          max={totalBytes}
          value={downloadedBytes}
          variant="brand"
          ariaLabel={i18n('icu:BackupMediaDownloadProgress__title-offline')}
        />
      </div>
    );
  } else {
    content = (
      <>
        <div className="BackupMediaDownloadProgress__title">
          {i18n('icu:BackupMediaDownloadProgress__title-in-progress')}
        </div>

        <div className="BackupMediaDownloadProgress__description">
          {i18n('icu:BackupMediaDownloadProgress__progressbar-hint', {
            currentSize: formatFileSize(downloadedBytes),
            totalSize: formatFileSize(totalBytes),
          })}
        </div>
      </>
    );
    icon = (
      <div className="BackupMediaDownloadProgress__icon">
        <SpinnerV2
          size={24}
          strokeWidth={3}
          marginRatio={1}
          min={0}
          max={totalBytes}
          value={downloadedBytes}
          variant="brand"
          ariaLabel={i18n('icu:BackupMediaDownloadProgress__title-in-progress')}
        />
      </div>
    );
  }

  return (
    <LeftPaneDialog
      type="info"
      containerWidthBreakpoint={widthBreakpoint}
      icon={icon}
    >
      <div className="BackupMediaDownloadProgress__content">{content}</div>
      {widthBreakpoint !== WidthBreakpoint.Narrow ? actionButton : null}
      {isShowingCancelConfirmation ? (
        <BackupMediaDownloadCancelConfirmationDialog
          i18n={i18n}
          handleDialogClose={() => setIsShowingCancelConfirmation(false)}
          handleConfirmCancel={handleConfirmedCancel}
        />
      ) : null}
    </LeftPaneDialog>
  );
}
