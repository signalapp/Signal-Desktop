// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect } from 'react';
import type { LocalizerType } from '../types/Util';

export type PropsType = {
  deleteAllData: () => void;
  i18n: LocalizerType;
};

export function ClearingData({ deleteAllData, i18n }: PropsType): JSX.Element {
  useEffect(() => {
    deleteAllData();
  }, [deleteAllData]);

  return (
    <div className="full-screen-flow overlay">
      <div className="step">
        <div className="inner">
          <div className="step-body">
            <span className="banner-icon delete" />
            <div className="header">{i18n('deleteAllDataProgress')}</div>
          </div>
          <div className="progress">
            <div className="bar-container">
              <div className="bar progress-bar progress-bar-striped active" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
