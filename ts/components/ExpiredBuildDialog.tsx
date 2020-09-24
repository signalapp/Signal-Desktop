import React from 'react';

import { LocalizerType } from '../types/Util';

interface PropsType {
  hasExpired: boolean;
  i18n: LocalizerType;
}

export const ExpiredBuildDialog = ({
  hasExpired,
  i18n,
}: PropsType): JSX.Element | null => {
  if (!hasExpired) {
    return null;
  }

  return (
    <div className="module-left-pane-dialog module-left-pane-dialog--error">
      {i18n('expiredWarning')}
      <div className="module-left-pane-dialog__actions">
        <a
          className="module-left-pane-dialog__link"
          href="https://signal.org/download/"
          rel="noreferrer"
          tabIndex={-1}
          target="_blank"
        >
          <button type="button" className="upgrade">
            {i18n('upgrade')}
          </button>
        </a>
      </div>
    </div>
  );
};
