// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../types/Util';
import { formatFileSize } from '../util/formatFileSize';
import { ProgressBar } from './ProgressBar';

export type PropsType = Readonly<{
  i18n: LocalizerType;
  downloadedBytes: number;
  totalBytes: number;
}>;

export function BackupMediaDownloadProgressBanner({
  i18n,
  downloadedBytes,
  totalBytes,
}: PropsType): JSX.Element | null {
  if (totalBytes === 0) {
    return null;
  }

  const fractionComplete = Math.max(
    0,
    Math.min(1, downloadedBytes / totalBytes)
  );

  return (
    <div className="BackupMediaDownloadProgressBanner">
      <div className="BackupMediaDownloadProgressBanner__icon" />
      <div className="BackupMediaDownloadProgressBanner__content">
        <div className="BackupMediaDownloadProgressBanner__title">
          {i18n('icu:BackupMediaDownloadProgress__title')}
        </div>
        <ProgressBar fractionComplete={fractionComplete} />
        <div className="BackupMediaDownloadProgressBanner__progressbar-hint">
          {i18n('icu:BackupMediaDownloadProgress__progressbar-hint', {
            currentSize: formatFileSize(downloadedBytes),
            totalSize: formatFileSize(totalBytes),
            fractionComplete,
          })}
        </div>
      </div>
    </div>
  );
}
