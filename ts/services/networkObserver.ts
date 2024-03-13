// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  CheckNetworkStatusPayloadType,
  NetworkActionType,
} from '../state/ducks/network';
import { getSocketStatus } from '../shims/socketStatus';
import * as log from '../logging/log';
import { SECOND } from '../util/durations';
import { electronLookup } from '../util/dns';
import { drop } from '../util/drop';
import { SocketStatus } from '../types/SocketStatus';

// DNS TTL
const OUTAGE_CHECK_INTERVAL = 60 * SECOND;
const OUTAGE_HEALTY_ADDR = '127.0.0.1';
const OUTAGE_NO_SERVICE_ADDR = '127.0.0.2';

type NetworkActions = {
  checkNetworkStatus: (x: CheckNetworkStatusPayloadType) => NetworkActionType;
  closeConnectingGracePeriod: () => NetworkActionType;
  setOutage: (isOutage: boolean) => NetworkActionType;
};

export function initializeNetworkObserver(
  networkActions: NetworkActions
): void {
  log.info('Initializing network observer');

  const refresh = () => {
    const socketStatus = getSocketStatus();

    networkActions.checkNetworkStatus({
      isOnline: navigator.onLine,
      socketStatus,
    });

    if (socketStatus === SocketStatus.OPEN) {
      onOutageEnd();
    }
  };

  let outageTimer: NodeJS.Timeout | undefined;

  const checkOutage = async (): Promise<void> => {
    electronLookup('uptime.signal.org', { all: false }, (error, address) => {
      if (error) {
        log.error('networkObserver: outage check failure', error);
        return;
      }

      if (address === OUTAGE_HEALTY_ADDR) {
        log.info(
          'networkObserver: got healthy response from uptime.signal.org'
        );
        onOutageEnd();
      } else if (address === OUTAGE_NO_SERVICE_ADDR) {
        log.warn('networkObserver: service is down');
        networkActions.setOutage(true);
      } else {
        log.error(
          'networkObserver: unexpected DNS response for uptime.signal.org'
        );
      }
    });
  };

  const onPotentialOutage = (): void => {
    if (outageTimer != null) {
      return;
    }

    log.warn('networkObserver: initiating outage check');

    outageTimer = setInterval(() => drop(checkOutage()), OUTAGE_CHECK_INTERVAL);
    drop(checkOutage());
  };

  const onOutageEnd = (): void => {
    if (outageTimer == null) {
      return;
    }

    log.warn('networkObserver: clearing outage check');
    clearInterval(outageTimer);
    outageTimer = undefined;

    networkActions.setOutage(false);
  };

  window.Whisper.events.on('socketStatusChange', refresh);
  window.Whisper.events.on('socketConnectError', onPotentialOutage);

  window.addEventListener('online', refresh);
  window.addEventListener('offline', refresh);
  window.setTimeout(() => {
    networkActions.closeConnectingGracePeriod();
  }, 5 * SECOND);
}
