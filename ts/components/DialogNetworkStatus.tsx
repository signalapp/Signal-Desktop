// Copyright 2020 Signal Messenger, LLC
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

export type PropsType = Pick<
  NetworkStateType,
  'isOnline' | 'isOutage' | 'socketStatus'
> & {
  containerWidthBreakpoint: WidthBreakpoint;
  i18n: LocalizerType;
  manualReconnect: () => void;
};

export function DialogNetworkStatus({
  containerWidthBreakpoint,
  i18n,
  isOnline,
  isOutage,
  socketStatus,
  manualReconnect,
}: PropsType): JSX.Element | null {
  const [isConnecting, setIsConnecting] = React.useState<boolean>(
    socketStatus === SocketStatus.CONNECTING
  );
  useEffect(() => {
    let timeout: NodeJS.Timeout;

    if (isConnecting) {
      timeout = setTimeout(() => {
        setIsConnecting(false);
      }, FIVE_SECONDS);
    }

    return () => {
      clearTimeoutIfNecessary(timeout);
    };
  }, [isConnecting, setIsConnecting]);

  const reconnect = () => {
    setIsConnecting(true);
    manualReconnect();
  };

  if (isOutage) {
    return (
      <LeftPaneDialog
        containerWidthBreakpoint={containerWidthBreakpoint}
        type="warning"
        icon="error"
        subtitle={i18n('icu:DialogNetworkStatus__outage')}
      />
    );
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
        title={i18n('icu:connecting')}
        subtitle={i18n('icu:connectingHangOn')}
      />
    );
  }

  return (
    <LeftPaneDialog
      containerWidthBreakpoint={containerWidthBreakpoint}
      type="warning"
      icon="network"
      title={isOnline ? i18n('icu:disconnected') : i18n('icu:offline')}
      subtitle={i18n('icu:checkNetworkConnection')}
      hasAction
      clickLabel={i18n('icu:connect')}
      onClick={reconnect}
    />
  );
}
