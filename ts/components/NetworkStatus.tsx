import React from 'react';

import { LocalizerType } from '../types/Util';
import { NetworkStateType } from '../state/ducks/network';

const FIVE_SECONDS = 5 * 1000;

export interface PropsType extends NetworkStateType {
  hasNetworkDialog: boolean;
  i18n: LocalizerType;
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
  socketStatus,
  manualReconnect,
}: PropsType): JSX.Element | null => {
  const [isConnecting, setIsConnecting] = React.useState<boolean>(false);
  React.useEffect(() => {
    if (!hasNetworkDialog) {
      return () => null;
    }

    let timeout: NodeJS.Timeout;

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
  }, [hasNetworkDialog, isConnecting, setIsConnecting]);

  if (!hasNetworkDialog) {
    return null;
  }

  const reconnect = () => {
    setIsConnecting(true);
    manualReconnect();
  };

  const manualReconnectButton = (): JSX.Element => (
    <div className="module-left-pane-dialog__actions">
      <button onClick={reconnect} type="button">
        {i18n('connect')}
      </button>
    </div>
  );

  if (isConnecting) {
    return renderDialog({
      subtext: i18n('connectingHangOn'),
      title: i18n('connecting'),
    });
  }
  if (!isOnline) {
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
