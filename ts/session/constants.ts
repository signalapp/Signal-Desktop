import { DAYS, HOURS, MINUTES } from './utils/Number';
// tslint:disable: binary-expression-operand-order

/**
 * FIXME The -1 hours is a hack to make the PN not trigger a Notification for those control message.
 * Apple devices must show a Notification if a PN is received, and for those
 * control message, there is nothing to display (yet).
 */
export const TTL_DEFAULT = {
  PAIRING_REQUEST: 2 * MINUTES,
  DEVICE_UNPAIRING: 4 * DAYS - 1 * HOURS,
  SESSION_REQUEST: 4 * DAYS - 1 * HOURS,
  SESSION_ESTABLISHED: 2 * DAYS - 1 * HOURS,
  END_SESSION_MESSAGE: 4 * DAYS - 1 * HOURS,
  TYPING_MESSAGE: 1 * MINUTES,
  ONLINE_BROADCAST: 1 * MINUTES,
  REGULAR_MESSAGE: 2 * DAYS,
};
