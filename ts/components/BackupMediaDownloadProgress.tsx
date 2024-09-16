// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';

import type { LocalizerType } from '../types/Util';
import { formatFileSize } from '../util/formatFileSize';
import { roundFractionForProgressBar } from '../util/numbers';
import { ProgressCircle } from './ProgressCircle';
import { ContextMenu } from './ContextMenu';
import { BackupMediaDownloadCancelConfirmationDialog } from './BackupMediaDownloadCancelConfirmationDialog';

export type PropsType = Readonly<{
  i18n: LocalizerType;
  downloadedBytes: number;
  totalBytes: number;
  isPaused: boolean;
  handleCancel: VoidFunction;
  handleClose: VoidFunction;
  handleResume: VoidFunction;
  handlePause: VoidFunction;
}>;

export function BackupMediaDownloadProgress({
  i18n,
  downloadedBytes,
  totalBytes,
  isPaused,
  handleCancel: handleConfirmedCancel,
  handleClose,
  handleResume,
  handlePause,
}: PropsType): JSX.Element | null {
  const [isShowingCancelConfirmation, setIsShowingCancelConfirmation] =
    useState(false);
  if (totalBytes === 0) {
    return null;
  }

  function handleCancel() {
    setIsShowingCancelConfirmation(true);
  }

  const fractionComplete = roundFractionForProgressBar(
    downloadedBytes / totalBytes
  );

  let content: JSX.Element | undefined;
  let icon: JSX.Element | undefined;
  let actionButton: JSX.Element | undefined;
  if (fractionComplete === 1) {
    icon = <div className="BackupMediaDownloadProgress__icon--complete" />;
    content = (
      <>
        <div className="BackupMediaDownloadProgress__title">
          {i18n('icu:BackupMediaDownloadProgress__title-complete')}
        </div>
        <div className="BackupMediaDownloadProgress__progressbar-hint">
          {formatFileSize(downloadedBytes)}
        </div>
      </>
    );
    actionButton = (
      <button
        type="button"
        onClick={handleClose}
        className="BackupMediaDownloadProgress__button-close"
        aria-label={i18n('icu:close')}
      />
    );
  } else {
    icon = <ProgressCircle fractionComplete={fractionComplete} />;

    if (isPaused) {
      content = (
        <>
          <div className="BackupMediaDownloadProgress__title">
            {i18n('icu:BackupMediaDownloadProgress__title-paused')}
          </div>
          <button
            type="button"
            onClick={handleResume}
            className="BackupMediaDownloadProgress__button"
            aria-label={i18n('icu:BackupMediaDownloadProgress__button-resume')}
          >
            {i18n('icu:BackupMediaDownloadProgress__button-resume')}
          </button>
        </>
      );
    } else {
      content = (
        <>
          <div className="BackupMediaDownloadProgress__title">
            {i18n('icu:BackupMediaDownloadProgress__title-in-progress')}
          </div>

          <div className="BackupMediaDownloadProgress__progressbar-hint">
            {i18n('icu:BackupMediaDownloadProgress__progressbar-hint', {
              currentSize: formatFileSize(downloadedBytes),
              totalSize: formatFileSize(totalBytes),
            })}
          </div>
        </>
      );
    }

    actionButton = (
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
        moduleClassName="Stories__pane__settings"
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
  }

  return (
    <div className="BackupMediaDownloadProgress">
      {icon}
      <div className="BackupMediaDownloadProgress__content">{content}</div>
      {actionButton}
      {isShowingCancelConfirmation ? (
        <BackupMediaDownloadCancelConfirmationDialog
          i18n={i18n}
          handleDialogClose={() => setIsShowingCancelConfirmation(false)}
          handleConfirmCancel={handleConfirmedCancel}
        />
      ) : null}
    </div>
  );
}
