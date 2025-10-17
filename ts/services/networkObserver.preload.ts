// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  SetNetworkStatusPayloadType,
  NetworkActionType,
} from '../state/ducks/network.dom.js';
import { createLogger } from '../logging/log.std.js';
import { SECOND } from '../util/durations/index.std.js';
import { electronLookup } from '../util/dns.node.js';
import { drop } from '../util/drop.std.js';
import { SocketStatus } from '../types/SocketStatus.std.js';

const log = createLogger('networkObserver');

// DNS TTL
const OUTAGE_CHECK_INTERVAL = 60 * SECOND;
const OUTAGE_HEALTY_ADDR = '127.0.0.1';
const OUTAGE_NO_SERVICE_ADDR = '127.0.0.2';

enum OnlineStatus {
  Online = 'Online',
  MaybeOffline = 'MaybeOffline',
  Offline = 'Offline',
}

const OFFLINE_DELAY = 5 * SECOND;

type NetworkActions = {
  setNetworkStatus: (x: SetNetworkStatusPayloadType) => NetworkActionType;
  setOutage: (isOutage: boolean) => NetworkActionType;
};

export function initializeNetworkObserver(
  networkActions: NetworkActions,
  getAuthSocketStatus: () => SocketStatus
): void {
  log.info('Initializing network observer');

  let onlineStatus = OnlineStatus.Online;

  const refresh = () => {
    const socketStatus = getAuthSocketStatus();

    networkActions.setNetworkStatus({
      isOnline: onlineStatus !== OnlineStatus.Offline,
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
        log.error('outage check failure', error);
        return;
      }

      if (address === OUTAGE_HEALTY_ADDR) {
        log.info('got healthy response from uptime.signal.org');
        onOutageEnd();
      } else if (address === OUTAGE_NO_SERVICE_ADDR) {
        log.warn('service is down');
        networkActions.setOutage(true);
      } else {
        log.error('unexpected DNS response for uptime.signal.org');
      }
    });
  };

  const onPotentialOutage = (): void => {
    if (outageTimer != null) {
      return;
    }

    log.warn('initiating outage check');

    outageTimer = setInterval(() => drop(checkOutage()), OUTAGE_CHECK_INTERVAL);
    drop(checkOutage());
  };

  const onOutageEnd = (): void => {
    if (outageTimer == null) {
      return;
    }

    log.warn('clearing outage check');
    clearInterval(outageTimer);
    outageTimer = undefined;

    networkActions.setOutage(false);
  };

  let offlineTimer: NodeJS.Timeout | undefined;

  window.Whisper.events.on('socketStatusChange', refresh);
  window.Whisper.events.on('online', () => {
    onlineStatus = OnlineStatus.Online;
    if (offlineTimer) {
      clearTimeout(offlineTimer);
      offlineTimer = undefined;
    }
    refresh();
  });
  window.Whisper.events.on('offline', () => {
    if (onlineStatus !== OnlineStatus.Online) {
      return;
    }

    onlineStatus = OnlineStatus.MaybeOffline;
    offlineTimer = setTimeout(() => {
      onlineStatus = OnlineStatus.Offline;
      refresh();
      onPotentialOutage();
    }, OFFLINE_DELAY);
  });
}
