import { NumberUtils } from './utils';

// Default TTL
export const TTL_DEFAULT = {
  PAIRING_REQUEST: NumberUtils.timeAsMs(2, 'minutes'),
  DEVICE_UNPAIRING: NumberUtils.timeAsMs(4 * 24 - 1, 'hours'),
  SESSION_REQUEST: NumberUtils.timeAsMs(4 * 24 - 1, 'hours'),
  SESSION_ESTABLISHED: NumberUtils.timeAsMs(2 * 24 - 1, 'hours'),
  END_SESSION_MESSAGE: NumberUtils.timeAsMs(4 * 24 - 1, 'hours'),
  TYPING_MESSAGE: NumberUtils.timeAsMs(1, 'minute'),
  ONLINE_BROADCAST: NumberUtils.timeAsMs(1, 'minute'),
  REGULAR_MESSAGE: NumberUtils.timeAsMs(2, 'days'),
};
