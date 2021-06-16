import moment from 'moment';

const getExtendedFormats = () => ({
  y: 'lll',
  M: `${window.i18n('timestampFormat_M') || 'MMM D'} LT`,
  d: 'ddd LT',
});
const getShortFormats = () => ({
  y: 'll',
  M: window.i18n('timestampFormat_M') || 'MMM D',
  d: 'ddd',
});

function isYear(timestamp: moment.Moment) {
  const year = moment().format('YYYY');
  const targetYear = moment(timestamp).format('YYYY');

  return year === targetYear;
}

export function formatRelativeTime(rawTimestamp: number | Date, options: { extended?: boolean }) {
  const { extended } = options;
  const formats = extended ? getExtendedFormats() : getShortFormats();
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
