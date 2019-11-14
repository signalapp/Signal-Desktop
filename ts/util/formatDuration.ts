import moment from 'moment';

const HOUR = 1000 * 60 * 60;

export function formatDuration(seconds: number) {
  const time = moment.utc(seconds * 1000);

  if (seconds > HOUR) {
    return time.format('H:mm:ss');
  }

  return time.format('m:ss');
}
