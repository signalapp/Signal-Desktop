// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../types/Util';
import { formatFileSize } from '../util/formatFileSize';
import { TitlebarDragArea } from './TitlebarDragArea';
import { InstallScreenSignalLogo } from './installScreen/InstallScreenSignalLogo';

// We can't always use destructuring assignment because of the complexity of this props
//   type.

export type PropsType = Readonly<{
  i18n: LocalizerType;
  currentBytes?: number;
  totalBytes?: number;
}>;

export function BackupImportScreen({
  i18n,
  currentBytes,
  totalBytes,
}: PropsType): JSX.Element {
  let percentage = 0;
  let progress: JSX.Element;
  if (currentBytes != null && totalBytes != null) {
    percentage = Math.max(0, Math.min(1, currentBytes / totalBytes));
    if (percentage > 0 && percentage <= 0.01) {
      percentage = 0.01;
    } else if (percentage >= 0.99 && percentage < 1) {
      percentage = 0.99;
    } else {
      percentage = Math.round(percentage * 100) / 100;
    }

    progress = (
      <>
        <div className="BackupImportScreen__progressbar">
          <div
            className="BackupImportScreen__progressbar__fill"
            style={{ transform: `translateX(${(percentage - 1) * 100}%)` }}
          />
        </div>
        <div className="BackupImportScreen__progressbar-hint">
          {i18n('icu:BackupImportScreen__progressbar-hint', {
            currentSize: formatFileSize(currentBytes),
            totalSize: formatFileSize(totalBytes),
            fractionComplete: percentage,
          })}
        </div>
      </>
    );
  } else {
    progress = (
      <>
        <div className="BackupImportScreen__progressbar" />
        <div className="BackupImportScreen__progressbar-hint BackupImportScreen__progressbar-hint--hidden">
          {i18n('icu:BackupImportScreen__progressbar-hint', {
            currentSize: '',
            totalSize: '',
            fractionComplete: 0,
          })}
        </div>
      </>
    );
  }
  return (
    <div className="BackupImportScreen">
      <TitlebarDragArea />

      <InstallScreenSignalLogo />

      <div className="BackupImportScreen__content">
        <h3 className="BackupImportScreen__title">
          {i18n('icu:BackupImportScreen__title')}
        </h3>
        {progress}
        <div className="BackupImportScreen__description">
          {i18n('icu:BackupImportScreen__description')}
        </div>
      </div>
    </div>
  );
}
