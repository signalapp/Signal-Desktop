// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect } from 'react';

import { LeftPaneDialog } from './LeftPaneDialog';
import { Spinner } from './Spinner';
import type { LocalizerType } from '../types/Util';
import { SocketStatus } from '../types/SocketStatus';
import type { NetworkStateType } from '../state/ducks/network';
import type { WidthBreakpoint } from './_util';
import { clearTimeoutIfNecessary } from '../util/clearTimeoutIfNecessary';

const FIVE_SECONDS = 5 * 1000;

export type PropsType = NetworkStateType & {
  containerWidthBreakpoint: WidthBreakpoint;
  hasNetworkDialog: boolean;
  i18n: LocalizerType;
  manualReconnect: () => void;
};

export const DialogNetworkStatus = ({
  containerWidthBreakpoint,
  hasNetworkDialog,
  i18n,
  isOnline,
  socketStatus,
  manualReconnect,
}: PropsType): JSX.Element | null => {
  const [isConnecting, setIsConnecting] = React.useState<boolean>(
    socketStatus === SocketStatus.CONNECTING
  );
  useEffect(() => {
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
      clearTimeoutIfNecessary(timeout);
    };
  }, [hasNetworkDialog, isConnecting, setIsConnecting]);

  const reconnect = () => {
    setIsConnecting(true);
    manualReconnect();
  };

  if (!hasNetworkDialog) {
    return null;
  }

  if (isConnecting) {
    const spinner = (
      <div className="LeftPaneDialog__spinner-container">
        <Spinner
          direction="on-avatar"
          moduleClassName="LeftPaneDialog__spinner"
          size="22px"
          svgSize="small"
        />
      </div>
    );

    return (
      <LeftPaneDialog
        containerWidthBreakpoint={containerWidthBreakpoint}
        type="warning"
        icon={spinner}
        title={i18n('connecting')}
        subtitle={i18n('connectingHangOn')}
      />
    );
  }

  return (
    <LeftPaneDialog
      containerWidthBreakpoint={containerWidthBreakpoint}
      type="warning"
      icon="network"
      title={isOnline ? i18n('disconnected') : i18n('offline')}
      subtitle={i18n('checkNetworkConnection')}
      hasAction
      clickLabel={i18n('connect')}
      onClick={reconnect}
    />
  );
};
