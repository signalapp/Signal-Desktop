// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState, type JSX } from 'react';

import { TitlebarDragArea } from './TitlebarDragArea.dom.tsx';
import { ProgressBar } from './ProgressBar.dom.tsx';
import { InstallScreenSignalLogo } from './installScreen/InstallScreenSignalLogo.dom.tsx';

import type { LocalizerType } from '../types/Util.std.ts';
import type { StateType } from '../shims/deleteAllData.preload.ts';
import { missingCaseError } from '../util/missingCaseError.std.ts';

export type PropsType = {
  deleteAllData: (callback: (state: StateType) => unknown) => void;
  i18n: LocalizerType;
};

export function ClearingData({ deleteAllData, i18n }: PropsType): JSX.Element {
  const [state, setState] = useState<StateType>();

  useEffect(() => {
    deleteAllData(newState => {
      setState(newState);
    });
  }, [deleteAllData, setState]);

  let title;
  let description;
  if (state === undefined) {
    title = '';
    description = '';
  } else if (state === 'leaving-groups') {
    title = i18n('icu:DeletingAccount__LeavingGroups__Title');
    description = i18n('icu:DeletingAccount__LeavingGroups__Detail');
  } else if (state === 'deleting-account') {
    title = i18n('icu:DeletingAccount__DeletingData__Title');
    description = i18n('icu:DeletingAccount__DeletingData__Detail');
  } else if (state === 'deleting-data') {
    title = i18n('icu:deleteAllDataProgress');
    description = i18n('icu:ClearingData__description');
  } else {
    throw missingCaseError(state);
  }

  return (
    <div className="ClearingData">
      <TitlebarDragArea />
      <InstallScreenSignalLogo />

      <div className="InstallScreenBackupImportStep__content">
        <h3 className="InstallScreenBackupImportStep__title">{title}</h3>
        <div className="ClearingData__ProgressBar">
          <ProgressBar
            fractionComplete={null}
            isRTL={i18n.getLocaleDirection() === 'rtl'}
          />
        </div>
        <div className="InstallScreenBackupImportStep__description">
          {description}
        </div>
      </div>
    </div>
  );
}
