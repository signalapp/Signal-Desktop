// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  CheckNetworkStatusPayloadType,
  NetworkActionType,
} from '../state/ducks/network';
import { getSocketStatus } from '../shims/socketStatus';
import * as log from '../logging/log';
import { SECOND } from '../util/durations';
import { SocketStatus } from '../types/SocketStatus';

type NetworkActions = {
  checkNetworkStatus: (x: CheckNetworkStatusPayloadType) => NetworkActionType;
  closeConnectingGracePeriod: () => NetworkActionType;
};

export function initializeNetworkObserver(
  networkActions: NetworkActions
): void {
  log.info('Initializing network observer');

  const refresh = () => {
    const socketStatus = getSocketStatus();

    if (socketStatus === SocketStatus.CLOSED) {
      // If we couldn't connect during startup - we should still switch SQL to
      // the main process to avoid stalling UI.
      window.Signal.Data.goBackToMainProcess();
    }

    networkActions.checkNetworkStatus({
      isOnline: navigator.onLine,
      socketStatus,
    });
  };

  window.Whisper.events.on('socketStatusChange', refresh);

  window.addEventListener('online', refresh);
  window.addEventListener('offline', refresh);
  window.setTimeout(() => {
    networkActions.closeConnectingGracePeriod();
  }, 5 * SECOND);
}
