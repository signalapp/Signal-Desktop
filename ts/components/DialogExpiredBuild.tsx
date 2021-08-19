// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { LocalizerType } from '../types/Util';

type PropsType = {
  hasExpired: boolean;
  i18n: LocalizerType;
};

export const DialogExpiredBuild = ({
  hasExpired,
  i18n,
}: PropsType): JSX.Element | null => {
  if (!hasExpired) {
    return null;
  }

  return (
    <div className="LeftPaneDialog LeftPaneDialog--error">
      <div className="LeftPaneDialog__message">
        {i18n('expiredWarning')}{' '}
        <a
          className="LeftPaneDialog__action-text"
          href="https://signal.org/download/"
          rel="noreferrer"
          tabIndex={-1}
          target="_blank"
        >
          {i18n('upgrade')}
        </a>
      </div>
    </div>
  );
};
