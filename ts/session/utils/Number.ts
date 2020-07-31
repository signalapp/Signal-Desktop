type TimeUnit =
  | 'second'
  | 'seconds'
  | 'minute'
  | 'minutes'
  | 'hour'
  | 'hours'
  | 'day'
  | 'days';

export const MINUTES = 60 * 1000; // in ms
// tslint:disable: binary-expression-operand-order
export const HOURS = 60 * MINUTES; // in ms
export const DAYS = 24 * HOURS; // in ms

export const msAsUnit = (value: number, unit: TimeUnit) => {
  // Converts milliseconds to your preferred unit
  // Valid units: second(s), minute(s), hour(s), day(s)
  const unitAsSingular = unit.replace(new RegExp('s?$'), '');

  switch (unitAsSingular) {
    case 'second':
      return value / 1000;
    case 'minute':
      return value / 60 / 1000;
    case 'hour':
      return value / 60 / 60 / 1000;
    case 'day':
      return value / 24 / 60 / 60 / 1000;
    default:
      return value;
  }
};
