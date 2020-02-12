import React from 'react';
import moment from 'moment';

import { Dialogs } from '../types/Dialogs';
import { Intl } from './Intl';
import { LocalizerType } from '../types/Util';

export interface PropsType {
  ackRender: () => void;
  dialogType: Dialogs;
  dismissDialog: () => void;
  hasNetworkDialog: boolean;
  i18n: LocalizerType;
  startUpdate: () => void;
}

type MaybeMoment = moment.Moment | null;
type ReactSnoozeHook = React.Dispatch<React.SetStateAction<MaybeMoment>>;

const SNOOZE_TIMER = 60 * 1000 * 30;

function handleSnooze(setSnoozeForLater: ReactSnoozeHook) {
  setSnoozeForLater(moment().add(SNOOZE_TIMER));
  setTimeout(() => {
    setSnoozeForLater(moment());
  }, SNOOZE_TIMER);
}

function canSnooze(snoozeUntil: MaybeMoment) {
  return snoozeUntil === null;
}

function isSnoozed(snoozeUntil: MaybeMoment) {
  if (snoozeUntil === null) {
    return false;
  }

  return moment().isBefore(snoozeUntil);
}

export const UpdateDialog = ({
  ackRender,
  dialogType,
  dismissDialog,
  hasNetworkDialog,
  i18n,
  startUpdate,
}: PropsType): JSX.Element | null => {
  const [snoozeUntil, setSnoozeForLater] = React.useState<MaybeMoment>(null);

  React.useEffect(() => {
    ackRender();
  });

  if (hasNetworkDialog) {
    return null;
  }

  if (dialogType === Dialogs.None || isSnoozed(snoozeUntil)) {
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
              components={[
                <strong key="app">Signal.app</strong>,
                <strong key="folder">/Applications</strong>,
              ]}
              i18n={i18n}
              id="readOnlyVolume"
            />
          </span>
        </div>
        <div className="module-left-pane-dialog__actions">
          <button onClick={dismissDialog}>{i18n('ok')}</button>
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
        {canSnooze(snoozeUntil) && (
          <button
            className="module-left-pane-dialog__button--no-border"
            onClick={() => {
              handleSnooze(setSnoozeForLater);
            }}
          >
            {i18n('autoUpdateLaterButtonLabel')}
          </button>
        )}
        <button onClick={startUpdate}>
          {i18n('autoUpdateRestartButtonLabel')}
        </button>
      </div>
    </div>
  );
};
