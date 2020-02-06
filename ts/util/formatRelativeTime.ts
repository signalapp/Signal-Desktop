import moment from 'moment';
import { LocalizerType } from '../types/Util';

const getExtendedFormats = (i18n: LocalizerType) => ({
  y: 'lll',
  M: `${i18n('timestampFormat_M') || 'MMM D'} LT`,
  d: 'ddd LT',
});
const getShortFormats = (i18n: LocalizerType) => ({
  y: 'll',
  M: i18n('timestampFormat_M') || 'MMM D',
  d: 'ddd',
});

function isYear(timestamp: moment.Moment) {
  const year = moment().format('YYYY');
  const targetYear = moment(timestamp).format('YYYY');

  return year === targetYear;
}

export function formatRelativeTime(
  rawTimestamp: number | Date,
  options: { extended?: boolean; i18n: LocalizerType }
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
  }

  return timestamp.format(formats.d);
}
