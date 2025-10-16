// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';

import type { LocalizerType } from '../types/Util.std.js';
import { formatFileSize } from '../util/formatFileSize.std.js';
import { roundFractionForProgressBar } from '../util/numbers.std.js';
import { ProgressBar } from './ProgressBar.dom.js';
import { Button, ButtonSize, ButtonVariant } from './Button.dom.js';
import { BackupMediaDownloadCancelConfirmationDialog } from './BackupMediaDownloadCancelConfirmationDialog.dom.js';

export type PropsType = Readonly<{
  i18n: LocalizerType;
  completedBytes: number;
  totalBytes: number;
  isPaused: boolean;
  handleCancel: VoidFunction;
  handleResume: VoidFunction;
  handlePause: VoidFunction;
}>;

export function BackupMediaDownloadProgressSettings({
  i18n,
  completedBytes,
  totalBytes,
  isPaused,
  handleCancel,
  handleResume,
  handlePause,
}: PropsType): JSX.Element | null {
  const [isShowingCancelConfirmation, setIsShowingCancelConfirmation] =
    useState(false);
  const isRTL = i18n.getLocaleDirection() === 'rtl';
  if (totalBytes <= 0) {
    return null;
  }

  const fractionComplete = roundFractionForProgressBar(
    completedBytes / totalBytes
  );

  const isCompleted = fractionComplete === 1;

  if (isCompleted) {
    return null;
  }

  let title: string;
  let description: string;
  let actionButton: JSX.Element | undefined;

  if (isPaused) {
    title = i18n('icu:BackupMediaDownloadProgressSettings__paused--title');
    description = i18n(
      'icu:BackupMediaDownloadProgressSettings__paused--description',
      {
        resumeButtonText: i18n(
          'icu:BackupMediaDownloadProgressSettings__button-resume'
        ),
      }
    );
    actionButton = (
      <Button
        onClick={handleResume}
        variant={ButtonVariant.Secondary}
        size={ButtonSize.Small}
        className="BackupMediaDownloadProgressSettings__button"
      >
        {i18n('icu:BackupMediaDownloadProgressSettings__button-resume')}
      </Button>
    );
  } else {
    title = i18n('icu:BackupMediaDownloadProgressSettings__title-in-progress');
    description = i18n(
      'icu:BackupMediaDownloadProgressSettings__progressbar-hint',
      {
        currentSize: formatFileSize(completedBytes),
        totalSize: formatFileSize(totalBytes),
        fractionComplete,
      }
    );
    actionButton = (
      <Button
        onClick={handlePause}
        variant={ButtonVariant.Secondary}
        size={ButtonSize.Small}
        className="BackupMediaDownloadProgressSettings__button"
      >
        {i18n('icu:BackupMediaDownloadProgressSettings__button-pause')}
      </Button>
    );
  }

  return (
    <div className="BackupMediaDownloadProgressSettings">
      <div className="BackupMediaDownloadProgressSettings__content">
        <div className="BackupMediaDownloadProgressSettings__title">
          {title}
        </div>
        <div className="BackupMediaDownloadProgressSettings__ProgressBar">
          <ProgressBar fractionComplete={fractionComplete} isRTL={isRTL} />
        </div>
        <div className="BackupMediaDownloadProgressSettings__description">
          {description}
        </div>
      </div>
      <div className="BackupMediaDownloadProgressSettings__buttons">
        {actionButton}
        <Button
          onClick={() => setIsShowingCancelConfirmation(true)}
          variant={ButtonVariant.SecondaryDestructive}
          className="BackupMediaDownloadProgressSettings__button"
          size={ButtonSize.Small}
        >
          {i18n('icu:cancel')}
        </Button>
      </div>
      {isShowingCancelConfirmation ? (
        <BackupMediaDownloadCancelConfirmationDialog
          i18n={i18n}
          handleConfirmCancel={handleCancel}
          handleDialogClose={() => setIsShowingCancelConfirmation(false)}
        />
      ) : null}
    </div>
  );
}
