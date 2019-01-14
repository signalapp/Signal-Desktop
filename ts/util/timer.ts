import { padStart } from 'lodash';

export function getIncrement(length: number): number {
  if (length < 0) {
    return 1000;
  }

  return Math.ceil(length / 12);
}

export function getTimerBucket(expiration: number, length: number): string {
  const delta = expiration - Date.now();
  if (delta < 0) {
    return '00';
  }
  if (delta > length) {
    return '60';
  }

  const bucket = Math.round(delta / length * 12);

  return padStart(String(bucket * 5), 2, '0');
}
