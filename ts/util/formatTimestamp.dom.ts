// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import moment from 'moment';
import { HourCyclePreference } from '../types/I18N.std.js';
import type { LocalizerType } from '../types/Util.std.js';
import { assertDev } from './assert.std.js';
import { isYesterday, isToday, type RawTimestamp } from './timestamp.std.js';
import { HOUR, MINUTE, MONTH, WEEK } from './durations/index.std.js';

function getOptionsWithPreferences(
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormatOptions {
  const hourCyclePreference = window.SignalContext.getHourCyclePreference();
  if (options.hour12 != null) {
    return options;
  }
  if (hourCyclePreference === HourCyclePreference.Prefer12) {
    return { ...options, hour12: true };
  }
  if (hourCyclePreference === HourCyclePreference.Prefer24) {
    return { ...options, hour12: false };
  }
  return options;
}

/**
 * Chrome doesn't implement hour12 correctly
 */
function fixBuggyOptions(
  locales: Array<string>,
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormatOptions {
  const resolvedOptions = new Intl.DateTimeFormat(
    locales,
    options
  ).resolvedOptions();
  const resolvedLocale = new Intl.Locale(resolvedOptions.locale);
  let { hourCycle } = resolvedOptions;
  // Most languages should use either h24 or h12
  if (hourCycle === 'h24') {
    hourCycle = 'h23';
  }
  if (hourCycle === 'h11') {
    hourCycle = 'h12';
  }
  // Only Japanese should use h11 when using hour12 time
  if (hourCycle === 'h12' && resolvedLocale.language === 'ja') {
    hourCycle = 'h11';
  }
  return {
    ...options,
    hour12: undefined,
    hourCycle,
  };
}

function getCacheKey(
  locales: Array<string>,
  options: Intl.DateTimeFormatOptions
) {
  return `${locales.join(',')}:${Object.keys(options)
    .sort()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map(key => `${key}=${(options as any)[key]}`)
    .join(',')}`;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

export function getDateTimeFormatter(
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
  const preferredSystemLocales =
    window.SignalContext.getPreferredSystemLocales();
  const localeOverride = window.SignalContext.getLocaleOverride();
  const locales =
    localeOverride != null ? [localeOverride] : preferredSystemLocales;
  const optionsWithPreferences = getOptionsWithPreferences(options);
  const cacheKey = getCacheKey(locales, optionsWithPreferences);
  const cachedFormatter = formatterCache.get(cacheKey);
  if (cachedFormatter) {
    return cachedFormatter;
  }
  const fixedOptions = fixBuggyOptions(locales, optionsWithPreferences);
  const formatter = new Intl.DateTimeFormat(locales, fixedOptions);
  formatterCache.set(cacheKey, formatter);
  return formatter;
}

export function formatTimestamp(
  timestamp: number,
  options: Intl.DateTimeFormatOptions
): string {
  const formatter = getDateTimeFormatter(options);
  try {
    return formatter.format(timestamp);
  } catch (err) {
    assertDev(false, 'invalid timestamp');
    return '';
  }
}

export function formatDateTimeShort(
  i18n: LocalizerType,
  rawTimestamp: RawTimestamp
): string {
  const timestamp = rawTimestamp.valueOf();

  const now = Date.now();
  const diff = now - timestamp;

  if (diff < HOUR || isToday(timestamp)) {
    return formatTime(i18n, rawTimestamp, now);
  }

  const m = moment(timestamp);

  if (diff < WEEK && m.isSame(now, 'month')) {
    return formatTimestamp(timestamp, { weekday: 'short' });
  }

  if (m.isSame(now, 'year')) {
    return formatTimestamp(timestamp, {
      day: 'numeric',
      month: 'short',
    });
  }

  return formatTimestamp(timestamp, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTimeForAttachment(
  i18n: LocalizerType,
  rawTimestamp: RawTimestamp
): string {
  const timestamp = rawTimestamp.valueOf();

  const now = Date.now();
  const diff = now - timestamp;

  if (diff < HOUR || isToday(timestamp)) {
    return formatTime(i18n, rawTimestamp, now);
  }

  const m = moment(timestamp);

  if (diff < WEEK && m.isSame(now, 'month')) {
    return formatTimestamp(timestamp, {
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
    });
  }

  if (m.isSame(now, 'year')) {
    return formatTimestamp(timestamp, {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: 'numeric',
    });
  }

  return formatTimestamp(timestamp, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  });
}

export function formatDateTimeLong(
  i18n: LocalizerType,
  rawTimestamp: RawTimestamp
): string {
  const timestamp = rawTimestamp.valueOf();

  if (isToday(rawTimestamp)) {
    return i18n('icu:timestampFormat__long--today', {
      time: formatTimestamp(timestamp, {
        hour: 'numeric',
        minute: 'numeric',
      }),
    });
  }

  if (isYesterday(rawTimestamp)) {
    return i18n('icu:timestampFormat__long--yesterday', {
      time: formatTimestamp(timestamp, {
        hour: 'numeric',
        minute: 'numeric',
      }),
    });
  }

  return formatTimestamp(timestamp, {
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTime(
  i18n: LocalizerType,
  rawTimestamp: RawTimestamp,
  now: RawTimestamp,
  isRelativeTime?: boolean
): string {
  const timestamp = rawTimestamp.valueOf();
  const diff = now.valueOf() - timestamp;

  if (diff < MINUTE) {
    return i18n('icu:justNow');
  }

  if (diff < HOUR) {
    return i18n('icu:minutesAgo', {
      minutes: Math.floor(diff / MINUTE),
    });
  }

  if (isRelativeTime) {
    return i18n('icu:hoursAgo', {
      hours: Math.floor(diff / HOUR),
    });
  }

  return formatTimestamp(timestamp, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDate(
  i18n: LocalizerType,
  rawTimestamp: RawTimestamp
): string {
  if (isToday(rawTimestamp)) {
    return i18n('icu:today');
  }

  if (isYesterday(rawTimestamp)) {
    return i18n('icu:yesterday');
  }

  const m = moment(rawTimestamp);

  const timestamp = rawTimestamp.valueOf();

  if (Math.abs(m.diff(Date.now())) < 6 * MONTH) {
    return formatTimestamp(timestamp, {
      day: 'numeric',
      month: 'short',
      weekday: 'short',
    });
  }

  return formatTimestamp(timestamp, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
