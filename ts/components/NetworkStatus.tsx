import React from 'react';

import { LocalizerType } from '../types/Util';
import { NetworkStateType } from '../state/ducks/network';

export interface PropsType extends NetworkStateType {
  hasNetworkDialog: boolean;
  i18n: LocalizerType;
  isRegistrationDone: boolean;
  relinkDevice: () => void;
}

type RenderDialogTypes = {
  title: string;
  subtext: string;
  renderActionableButton?: () => JSX.Element;
};

function renderDialog({
  title,
  subtext,
  renderActionableButton,
}: RenderDialogTypes): JSX.Element {
  return (
    <div className="module-left-pane-dialog module-left-pane-dialog--warning">
      <div className="module-left-pane-dialog__message">
        <h3>{title}</h3>
        <span>{subtext}</span>
      </div>
      {renderActionableButton && renderActionableButton()}
    </div>
  );
}

export const NetworkStatus = ({
  hasNetworkDialog,
  i18n,
  isOnline,
  isRegistrationDone,
  socketStatus,
  relinkDevice,
}: PropsType): JSX.Element | null => {
  if (!hasNetworkDialog) {
    return null;
  }

  if (!isOnline) {
    return renderDialog({
      subtext: i18n('checkNetworkConnection'),
      title: i18n('offline'),
    });
  } else if (!isRegistrationDone) {
    return renderDialog({
      renderActionableButton: (): JSX.Element => (
        <div className="module-left-pane-dialog__actions">
          <button onClick={relinkDevice}>{i18n('relink')}</button>
        </div>
      ),
      subtext: i18n('unlinkedWarning'),
      title: i18n('unlinked'),
    });
  }

  let subtext = '';
  let title = '';

  switch (socketStatus) {
    case WebSocket.CONNECTING:
      subtext = i18n('connectingHangOn');
      title = i18n('connecting');
      break;
    case WebSocket.CLOSED:
    case WebSocket.CLOSING:
    default:
      title = i18n('disconnected');
      subtext = i18n('checkNetworkConnection');
  }

  return renderDialog({
    subtext,
    title,
  });
};
