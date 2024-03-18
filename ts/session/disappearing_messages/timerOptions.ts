import moment from 'moment';
import { isCI, isDevProd } from '../../shared/env_vars';
import { LocalizerKeys } from '../../types/LocalizerKeys';

type TimerOptionsEntry = { name: string; value: number };
export type TimerOptionsArray = Array<TimerOptionsEntry>;

const timerOptionsDurations: Array<{
  time: number;
  unit: moment.DurationInputArg2;
  seconds: number;
}> = [
  { time: 0, unit: 'seconds' as moment.DurationInputArg2 },
  { time: 5, unit: 'seconds' as moment.DurationInputArg2 },
  { time: 10, unit: 'seconds' as moment.DurationInputArg2 },
  { time: 30, unit: 'seconds' as moment.DurationInputArg2 },
  { time: 1, unit: 'minute' as moment.DurationInputArg2 },
  { time: 5, unit: 'minutes' as moment.DurationInputArg2 },
  { time: 30, unit: 'minutes' as moment.DurationInputArg2 },
  { time: 1, unit: 'hour' as moment.DurationInputArg2 },
  { time: 6, unit: 'hours' as moment.DurationInputArg2 },
  { time: 12, unit: 'hours' as moment.DurationInputArg2 },
  { time: 1, unit: 'day' as moment.DurationInputArg2 },
  { time: 1, unit: 'week' as moment.DurationInputArg2 },
  { time: 2, unit: 'weeks' as moment.DurationInputArg2 },
].map(o => {
  const duration = moment.duration(o.time, o.unit); // 5, 'seconds'
  return {
    time: o.time,
    unit: o.unit,
    seconds: duration.asSeconds(),
  };
});

function getTimerOptionName(time: number, unit: moment.DurationInputArg2) {
  return (
    window.i18n(['timerOption', time, unit].join('_') as LocalizerKeys) ||
    moment.duration(time, unit).humanize()
  );
}

function getTimerOptionAbbreviated(time: number, unit: string) {
  return window.i18n(['timerOption', time, unit, 'abbreviated'].join('_') as LocalizerKeys);
}

function getName(seconds = 0) {
  const o = timerOptionsDurations.find(m => m.seconds === seconds);

  if (o) {
    return getTimerOptionName(o.time, o.unit);
  }
  return [seconds, 'seconds'].join(' ');
}

function getAbbreviated(seconds = 0) {
  const o = timerOptionsDurations.find(m => m.seconds === seconds);

  if (o) {
    return getTimerOptionAbbreviated(o.time, o.unit);
  }

  return [seconds, 's'].join('');
}

const VALUES: Array<number> = timerOptionsDurations.map(t => {
  return t.seconds;
});

const filterOutDebugValues = (option: number) => {
  return isDevProd() || isCI() || option > 60; // when not a dev build nor on CI, filter out options with less than 60s
};

const DELETE_AFTER_READ = VALUES.filter(option => {
  return (
    option === 10 || // 10 seconds: filtered out when app is packaged with filterOutDebugValues
    option === 30 || // 30 seconds: filtered out when app is packaged with filterOutDebugValues
    option === 60 || // 1 minute  : filtered out when app is packaged with filterOutDebugValues
    option === 300 || // 5 minutes
    option === 3600 || // 1 hour
    option === 43200 || // 12 hours
    option === 86400 || // 1 day
    option === 604800 || // 1 week
    option === 1209600 // 2 weeks
  );
}).filter(filterOutDebugValues);

const DELETE_AFTER_SEND = VALUES.filter(option => {
  return (
    option === 10 || // 10 seconds: filtered out when app is packaged with filterOutDebugValues
    option === 30 || // 30 seconds: filtered out when app is packaged with filterOutDebugValues
    option === 60 || // 1 minute  : filtered out when app is packaged with filterOutDebugValues
    option === 43200 || // 12 hours
    option === 86400 || // 1 day
    option === 604800 || // 1 week
    option === 1209600 // 2 weeks
  );
}).filter(filterOutDebugValues);

// TODO legacy messages support will be removed in a future release
const DELETE_LEGACY = VALUES.filter(option => {
  return (
    option === 10 || // 10 seconds: filtered out when app is packaged with filterOutDebugValues
    option === 30 || // 30 seconds: filtered out when app is packaged with filterOutDebugValues
    option === 60 || // 1 minute  : filtered out when app is packaged with filterOutDebugValues
    option === 43200 || // 12 hours
    option === 86400 || // 1 day
    option === 604800 || // 1 week
    option === 1209600 // 2 weeks
  );
}).filter(filterOutDebugValues);

const DEFAULT_OPTIONS = {
  DELETE_AFTER_READ: 43200, // 12 hours
  DELETE_AFTER_SEND: 86400, // 1 day
  // TODO legacy messages support will be removed in a future release
  LEGACY: 86400, // 1 day
};

export const TimerOptions = {
  DEFAULT_OPTIONS,
  VALUES,
  DELETE_AFTER_READ,
  DELETE_AFTER_SEND,
  DELETE_LEGACY,
  getName,
  getAbbreviated,
};
