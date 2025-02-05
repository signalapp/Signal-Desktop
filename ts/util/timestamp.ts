// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Moment } from 'moment';
import moment from 'moment';
import type { LocalizerType } from '../types/Util';
import { DAY, HOUR, MINUTE, MONTH, WEEK } from './durations';
import { formatTimestamp } from './formatTimestamp';

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

export const MAX_SAFE_DATE = 8640000000000000;
export const MIN_SAFE_DATE = -8640000000000000;

export const MAX_SAFE_TIMEOUT_DELAY = 2147483647; // max 32-bit signed integer

export function toBoundedDate(timestamp: number): Date {
  return new Date(Math.max(MIN_SAFE_DATE, Math.min(timestamp, MAX_SAFE_DATE)));
}
