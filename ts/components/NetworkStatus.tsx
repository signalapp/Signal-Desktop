import React from 'react';

import { LocalizerType } from '../types/Util';
import { NetworkStateType } from '../state/ducks/network';

const FIVE_SECONDS = 5 * 1000;

export interface PropsType extends NetworkStateType {
  hasNetworkDialog: boolean;
  i18n: LocalizerType;
  isRegistrationDone: boolean;
  relinkDevice: () => void;
  manualReconnect: () => void;
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
  manualReconnect,
}: PropsType): JSX.Element | null => {
  if (!hasNetworkDialog) {
    return null;
  }

  const [isConnecting, setIsConnecting] = React.useState<boolean>(false);
  React.useEffect(() => {
    let timeout: any;

    if (isConnecting) {
      timeout = setTimeout(() => {
        setIsConnecting(false);
      }, FIVE_SECONDS);
    }

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [isConnecting, setIsConnecting]);

  const reconnect = () => {
    setIsConnecting(true);
    manualReconnect();
  };

  const manualReconnectButton = (): JSX.Element => (
    <div className="module-left-pane-dialog__actions">
      <button onClick={reconnect}>{i18n('connect')}</button>
    </div>
  );

  if (!isRegistrationDone) {
    return renderDialog({
      renderActionableButton: (): JSX.Element => (
        <div className="module-left-pane-dialog__actions">
          <button onClick={relinkDevice}>{i18n('relink')}</button>
        </div>
      ),
      subtext: i18n('unlinkedWarning'),
      title: i18n('unlinked'),
    });
  } else if (isConnecting) {
    return renderDialog({
      subtext: i18n('connectingHangOn'),
      title: i18n('connecting'),
    });
  } else if (!isOnline) {
    return renderDialog({
      renderActionableButton: manualReconnectButton,
      subtext: i18n('checkNetworkConnection'),
      title: i18n('offline'),
    });
  }

  let subtext = '';
  let title = '';
  let renderActionableButton;

  switch (socketStatus) {
    case WebSocket.CONNECTING:
      subtext = i18n('connectingHangOn');
      title = i18n('connecting');
      break;
    case WebSocket.CLOSED:
    case WebSocket.CLOSING:
    default:
      renderActionableButton = manualReconnectButton;
      title = i18n('disconnected');
      subtext = i18n('checkNetworkConnection');
  }

  return renderDialog({
    renderActionableButton,
    subtext,
    title,
  });
};
