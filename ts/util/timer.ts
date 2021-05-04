import { padStart } from 'lodash';
import { SessionIconType } from '../components/session/icon';

export function getIncrement(length: number): number {
  if (length < 0) {
    return 1000;
  }
  // if less than one minute, default to 500 ms so that UI counter is accurate
  if (length <= 60000) {
    return 500;
  }

  return Math.ceil(length / 12);
}

export function getTimerBucketIcon(expiration: number, length: number): SessionIconType {
  const delta = expiration - Date.now();
  if (delta < 0) {
    return SessionIconType.Timer60;
  }
  if (delta > length) {
    return SessionIconType.Timer00;
  }
  const bucket = Math.round((delta / length) * 12);

  const padded = padStart(String(bucket * 5), 2, '0');
  switch (padded) {
    case '00':
      return SessionIconType.Timer00;
    case '05':
      return SessionIconType.Timer05;
    case '10':
      return SessionIconType.Timer10;
    case '15':
      return SessionIconType.Timer15;
    case '20':
      return SessionIconType.Timer20;
    case '25':
      return SessionIconType.Timer25;
    case '30':
      return SessionIconType.Timer30;
    case '35':
      return SessionIconType.Timer35;
    case '40':
      return SessionIconType.Timer40;
    case '45':
      return SessionIconType.Timer45;
    case '50':
      return SessionIconType.Timer50;
    case '55':
      return SessionIconType.Timer55;
    default:
      return SessionIconType.Timer60;
  }
}
