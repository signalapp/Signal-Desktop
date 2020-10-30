// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { LocalizerType } from '../types/Util';

export interface PropsType {
  i18n: LocalizerType;
  isRegistrationDone: boolean;
  relinkDevice: () => void;
}

export const RelinkDialog = ({
  i18n,
  isRegistrationDone,
  relinkDevice,
}: PropsType): JSX.Element | null => {
  if (isRegistrationDone) {
    return null;
  }

  return (
    <div className="module-left-pane-dialog module-left-pane-dialog--warning">
      <div className="module-left-pane-dialog__message">
        <h3>{i18n('unlinked')}</h3>
        <span>{i18n('unlinkedWarning')}</span>
      </div>
      <div className="module-left-pane-dialog__actions">
        <button onClick={relinkDevice} type="button">
          {i18n('relink')}
        </button>
      </div>
    </div>
  );
};
