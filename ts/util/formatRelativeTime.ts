import moment from 'moment';
import { Localizer } from '../types/Util';

const getExtendedFormats = (i18n: Localizer) => ({
  y: 'lll',
  M: `${i18n('timestampFormat_M') || 'MMM D'} LT`,
  d: 'ddd LT',
});
const getShortFormats = (i18n: Localizer) => ({
  y: 'll',
  M: i18n('timestampFormat_M') || 'MMM D',
  d: 'ddd',
});

function isToday(timestamp: moment.Moment) {
  const today = moment().format('ddd');
  const targetDay = moment(timestamp).format('ddd');

  return today === targetDay;
}

function isYear(timestamp: moment.Moment) {
  const year = moment().format('YYYY');
  const targetYear = moment(timestamp).format('YYYY');

  return year === targetYear;
}

export function formatRelativeTime(
  rawTimestamp: number | Date,
  options: { extended: boolean; i18n: Localizer }
) {
  const { extended, i18n } = options;

  const formats = extended ? getExtendedFormats(i18n) : getShortFormats(i18n);
  const timestamp = moment(rawTimestamp);
  const now = moment();
  const diff = moment.duration(now.diff(timestamp));

  if (diff.years() >= 1 || !isYear(timestamp)) {
    return timestamp.format(formats.y);
  } else if (diff.months() >= 1 || diff.days() > 6) {
    return timestamp.format(formats.M);
  } else if (diff.days() >= 1 || !isToday(timestamp)) {
    return timestamp.format(formats.d);
  } else if (diff.hours() >= 1) {
    const key = extended ? 'hoursAgo' : 'hoursAgoShort';

    return i18n(key, [String(diff.hours())]);
  } else if (diff.minutes() >= 1) {
    const key = extended ? 'minutesAgo' : 'minutesAgoShort';

    return i18n(key, [String(diff.minutes())]);
  }

  return i18n('justNow');
}
