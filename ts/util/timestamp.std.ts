// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Moment } from 'moment';
import moment from 'moment';
import { DAY } from './durations/index.std.js';

export type RawTimestamp = Readonly<number | Date | Moment>;

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

export const isYesterday = (rawTimestamp: RawTimestamp): boolean =>
  isSameDay(rawTimestamp, moment().subtract(1, 'day'));

export const MAX_SAFE_DATE = 8640000000000000;
export const MIN_SAFE_DATE = -8640000000000000;

export function toBoundedDate(timestamp: number): Date {
  return new Date(Math.max(MIN_SAFE_DATE, Math.min(timestamp, MAX_SAFE_DATE)));
}
