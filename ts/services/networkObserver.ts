import {
  CheckNetworkStatusPayloadType,
  NetworkActionType,
} from '../state/ducks/network';
import { getSocketStatus } from '../shims/socketStatus';

type NetworkActions = {
  checkNetworkStatus: (x: CheckNetworkStatusPayloadType) => NetworkActionType;
  closeConnectingGracePeriod: () => NetworkActionType;
};

const REFRESH_INTERVAL = 5000;

export function initializeNetworkObserver(
  networkActions: NetworkActions
): void {
  const { log } = window;
  log.info(`Initializing network observer every ${REFRESH_INTERVAL}ms`);

  const refresh = () => {
    networkActions.checkNetworkStatus({
      isOnline: navigator.onLine,
      socketStatus: getSocketStatus(),
    });
  };

  window.addEventListener('online', refresh);
  window.addEventListener('offline', refresh);
  window.setInterval(refresh, REFRESH_INTERVAL);
  window.setTimeout(() => {
    networkActions.closeConnectingGracePeriod();
  }, REFRESH_INTERVAL);
}
