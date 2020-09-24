import React from 'react';

import { Dialogs } from '../types/Dialogs';
import { Intl } from './Intl';
import { LocalizerType } from '../types/Util';

export interface PropsType {
  ackRender: () => void;
  dialogType: Dialogs;
  didSnooze: boolean;
  dismissDialog: () => void;
  hasNetworkDialog: boolean;
  i18n: LocalizerType;
  showEventsCount: number;
  snoozeUpdate: () => void;
  startUpdate: () => void;
}

export const UpdateDialog = ({
  ackRender,
  dialogType,
  didSnooze,
  dismissDialog,
  hasNetworkDialog,
  i18n,
  snoozeUpdate,
  startUpdate,
}: PropsType): JSX.Element | null => {
  React.useEffect(() => {
    ackRender();
  });

  if (hasNetworkDialog) {
    return null;
  }

  if (dialogType === Dialogs.None) {
    return null;
  }

  if (dialogType === Dialogs.Cannot_Update) {
    return (
      <div className="module-left-pane-dialog module-left-pane-dialog--warning">
        <div className="module-left-pane-dialog__message">
          <h3>{i18n('cannotUpdate')}</h3>
          <span>
            <Intl
              components={[
                <a
                  key="signal-download"
                  href="https://signal.org/download/"
                  rel="noreferrer"
                  target="_blank"
                >
                  https://signal.org/download/
                </a>,
              ]}
              i18n={i18n}
              id="cannotUpdateDetail"
            />
          </span>
        </div>
      </div>
    );
  }

  if (dialogType === Dialogs.MacOS_Read_Only) {
    return (
      <div className="module-left-pane-dialog module-left-pane-dialog--warning">
        <div className="module-left-pane-dialog__message">
          <h3>{i18n('cannotUpdate')}</h3>
          <span>
            <Intl
              components={{
                app: <strong key="app">Signal.app</strong>,
                folder: <strong key="folder">/Applications</strong>,
              }}
              i18n={i18n}
              id="readOnlyVolume"
            />
          </span>
        </div>
        <div className="module-left-pane-dialog__actions">
          <button type="button" onClick={dismissDialog}>
            {i18n('ok')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="module-left-pane-dialog">
      <div className="module-left-pane-dialog__message">
        <h3>{i18n('autoUpdateNewVersionTitle')}</h3>
        <span>{i18n('autoUpdateNewVersionMessage')}</span>
      </div>
      <div className="module-left-pane-dialog__actions">
        {!didSnooze && (
          <button
            type="button"
            className="module-left-pane-dialog__button--no-border"
            onClick={snoozeUpdate}
          >
            {i18n('autoUpdateLaterButtonLabel')}
          </button>
        )}
        <button type="button" onClick={startUpdate}>
          {i18n('autoUpdateRestartButtonLabel')}
        </button>
      </div>
    </div>
  );
};
