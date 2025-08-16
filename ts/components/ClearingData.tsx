// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect } from 'react';

import type { LocalizerType } from '../types/Util';
import { TitlebarDragArea } from './TitlebarDragArea';
import { ProgressBar } from './ProgressBar';
import { InstallScreenSignalLogo } from './installScreen/InstallScreenSignalLogo';

export type PropsType = {
  deleteAllData: () => void;
  i18n: LocalizerType;
};

export function ClearingData({ deleteAllData, i18n }: PropsType): JSX.Element {
  useEffect(() => {
    deleteAllData();
  }, [deleteAllData]);

  return (
    <div className="ClearingData">
      <TitlebarDragArea />
      <InstallScreenSignalLogo />

      <div className="InstallScreenBackupImportStep__content">
        <h3 className="InstallScreenBackupImportStep__title">
          {i18n('icu:deleteAllDataProgress')}
        </h3>
        <ProgressBar
          fractionComplete={null}
          isRTL={i18n.getLocaleDirection() === 'rtl'}
        />
        <div className="InstallScreenBackupImportStep__description">
          {i18n('icu:ClearingData__description')}
        </div>
      </div>
    </div>
  );
}
