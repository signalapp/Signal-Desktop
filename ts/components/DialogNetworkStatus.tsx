// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { Spinner } from './Spinner';
import { LocalizerType } from '../types/Util';
import { SocketStatus } from '../types/SocketStatus';
import { NetworkStateType } from '../state/ducks/network';

const FIVE_SECONDS = 5 * 1000;

export type PropsType = NetworkStateType & {
  hasNetworkDialog: boolean;
  i18n: LocalizerType;
  manualReconnect: () => void;
};

type RenderDialogTypes = {
  isConnecting?: boolean;
  title: string;
  subtext: string;
  renderActionableButton?: () => JSX.Element;
};

function renderDialog({
  isConnecting,
  title,
  subtext,
  renderActionableButton,
}: RenderDialogTypes): JSX.Element {
  return (
    <div className="LeftPaneDialog LeftPaneDialog--warning">
      {isConnecting ? (
        <div className="LeftPaneDialog__spinner-container">
          <Spinner
            direction="on-avatar"
            moduleClassName="LeftPaneDialog__spinner"
            size="22px"
            svgSize="small"
          />
        </div>
      ) : (
        <div className="LeftPaneDialog__icon LeftPaneDialog__icon--network" />
      )}
      <div className="LeftPaneDialog__message">
        <h3>{title}</h3>
        <span>{subtext}</span>
        <div>{renderActionableButton && renderActionableButton()}</div>
      </div>
    </div>
  );
}

export const DialogNetworkStatus = ({
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
    <button
      className="LeftPaneDialog__action-text"
      onClick={reconnect}
      type="button"
    >
      {i18n('connect')}
    </button>
  );

  if (isConnecting) {
    return renderDialog({
      isConnecting: true,
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
    case SocketStatus.CONNECTING:
      subtext = i18n('connectingHangOn');
      title = i18n('connecting');
      break;
    case SocketStatus.CLOSED:
    case SocketStatus.CLOSING:
    default:
      renderActionableButton = manualReconnectButton;
      title = i18n('disconnected');
      subtext = i18n('checkNetworkConnection');
  }

  return renderDialog({
    isConnecting: socketStatus === SocketStatus.CONNECTING,
    renderActionableButton,
    subtext,
    title,
  });
};
