// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Moment } from 'moment';
import moment from 'moment';
import type { LocalizerType } from '../types/Util';
import { DAY, HOUR, MINUTE, MONTH, WEEK } from './durations';

type RawTimestamp = Readonly<number | Date | Moment>;

export function isMoreRecentThan(timestamp: number, delta: number): boolean {
  return timestamp > Date.now() - delta;
}

export function isOlderThan(timestamp: number, delta: number): boolean {
  return timestamp <= Date.now() - delta;
}

export function isInPast(timestamp: number): boolean {
  return isOlderThan(timestamp, 0);
}

export function isInFuture(timestamp: number): boolean {
  return isMoreRecentThan(timestamp, 0);
}

export function toDayMillis(timestamp: number): number {
  return timestamp - (timestamp % DAY);
}

export const isSameDay = (a: RawTimestamp, b: RawTimestamp): boolean =>
  moment(a).isSame(b, 'day');

export const isToday = (rawTimestamp: RawTimestamp): boolean =>
  isSameDay(rawTimestamp, Date.now());

const isYesterday = (rawTimestamp: RawTimestamp): boolean =>
  isSameDay(rawTimestamp, moment().subtract(1, 'day'));

export function formatDateTimeShort(
  i18n: LocalizerType,
  rawTimestamp: RawTimestamp
): string {
  const timestamp = rawTimestamp.valueOf();

  const now = Date.now();
  const diff = now - timestamp;

  const locale = window.getPreferredSystemLocales();

  if (diff < HOUR || isToday(timestamp)) {
    return formatTime(i18n, rawTimestamp, now);
  }

  const m = moment(timestamp);

  if (diff < WEEK && m.isSame(now, 'month')) {
    return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(
      timestamp
    );
  }

  if (m.isSame(now, 'year')) {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
    }).format(timestamp);
  }

  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(timestamp);
}

export function formatDateTimeForAttachment(
  i18n: LocalizerType,
  rawTimestamp: RawTimestamp
): string {
  const timestamp = rawTimestamp.valueOf();

  const now = Date.now();
  const diff = now - timestamp;

  const locale = window.getPreferredSystemLocales();

  if (diff < HOUR || isToday(timestamp)) {
    return formatTime(i18n, rawTimestamp, now);
  }

  const m = moment(timestamp);

  if (diff < WEEK && m.isSame(now, 'month')) {
    return new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
    }).format(timestamp);
  }

  if (m.isSame(now, 'year')) {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: 'numeric',
    }).format(timestamp);
  }

  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).format(timestamp);
}

export function formatDateTimeLong(
  i18n: LocalizerType,
  rawTimestamp: RawTimestamp
): string {
  const locale = window.getPreferredSystemLocales();
  const timestamp = rawTimestamp.valueOf();

  if (isToday(rawTimestamp)) {
    return i18n('icu:timestampFormat__long--today', {
      time: new Intl.DateTimeFormat(locale, {
        hour: 'numeric',
        minute: 'numeric',
      }).format(timestamp),
    });
  }

  if (isYesterday(rawTimestamp)) {
    return i18n('icu:timestampFormat__long--yesterday', {
      time: new Intl.DateTimeFormat(locale, {
        hour: 'numeric',
        minute: 'numeric',
      }).format(timestamp),
    });
  }

  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(timestamp);
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

  return new Date(timestamp).toLocaleTimeString([], {
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

  const locale = window.getPreferredSystemLocales();
  const m = moment(rawTimestamp);

  const timestamp = rawTimestamp.valueOf();

  if (Math.abs(m.diff(Date.now())) < 6 * MONTH) {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      weekday: 'short',
    }).format(timestamp);
  }

  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(timestamp);
}
