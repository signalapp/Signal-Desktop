import { padStart } from 'lodash';
import { SessionIconType } from '../components/icon/Icons';

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

export function getTimerBucketIcon(expirationMs: number, length: number): SessionIconType {
  const now = Date.now();
  const delta = expirationMs - now;

  if (delta < 0) {
    return 'timer60';
  }
  if (delta > length) {
    return 'timer00';
  }
  const bucket = Math.round((delta / length) * 12);

  const padded = padStart(String(bucket * 5), 2, '0');
  switch (padded) {
    case '00':
      return 'timer00';
    case '05':
      return 'timer05';
    case '10':
      return 'timer10';
    case '15':
      return 'timer15';
    case '20':
      return 'timer20';
    case '25':
      return 'timer25';
    case '30':
      return 'timer30';
    case '35':
      return 'timer35';
    case '40':
      return 'timer40';
    case '45':
      return 'timer45';
    case '50':
      return 'timer50';
    case '55':
      return 'timer55';
    default:
      return 'timer60';
  }
}
