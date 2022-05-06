// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Moment } from 'moment';
import moment from 'moment';
import type { LocalizerType } from '../types/Util';
import * as log from '../logging/log';
import { DAY, HOUR, MINUTE, MONTH, WEEK } from './durations';

const MAX_FORMAT_STRING_LENGTH = 50;

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

// This sanitization is probably unnecessary, but we do it just in case someone translates
//   a super long format string and causes performance issues.
function sanitizeFormatString(
  rawFormatString: string,
  fallback: string
): string {
  if (rawFormatString.length > MAX_FORMAT_STRING_LENGTH) {
    log.error(
      `Format string ${JSON.stringify(
        rawFormatString
      )} is too long. Falling back to ${fallback}`
    );
    return fallback;
  }
  return rawFormatString;
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
    return m.format('ddd');
  }

  if (m.isSame(now, 'year')) {
    return m.format(i18n('timestampFormat_M') || 'MMM D');
  }

  return m.format('ll');
}

export function formatDateTimeLong(
  i18n: LocalizerType,
  rawTimestamp: RawTimestamp
): string {
  let rawFormatString: string;
  if (isToday(rawTimestamp)) {
    rawFormatString = i18n('timestampFormat__long__today');
  } else if (isYesterday(rawTimestamp)) {
    rawFormatString = i18n('timestampFormat__long__yesterday');
  } else {
    rawFormatString = 'lll';
  }
  const formatString = sanitizeFormatString(rawFormatString, 'lll');

  return moment(rawTimestamp).format(formatString);
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
    return i18n('justNow');
  }

  if (diff < HOUR) {
    return i18n('minutesAgo', [Math.floor(diff / MINUTE).toString()]);
  }

  if (isRelativeTime) {
    return i18n('hoursAgo', [Math.floor(diff / HOUR).toString()]);
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
    return i18n('today');
  }

  if (isYesterday(rawTimestamp)) {
    return i18n('yesterday');
  }

  const m = moment(rawTimestamp);

  const formatI18nKey =
    Math.abs(m.diff(Date.now())) < 6 * MONTH
      ? 'TimelineDateHeader--date-in-last-6-months'
      : 'TimelineDateHeader--date-older-than-6-months';
  const rawFormatString = i18n(formatI18nKey);
  const formatString = sanitizeFormatString(rawFormatString, 'LL');

  return m.format(formatString);
}
