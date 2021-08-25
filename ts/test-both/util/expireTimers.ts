// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export type TestExpireTimer = Readonly<{ value: number; label: string }>;

const SECOND = 1;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

export const EXPIRE_TIMERS: ReadonlyArray<TestExpireTimer> = [
  { value: 42 * SECOND, label: '42 seconds' },
  { value: 5 * MINUTE, label: '5 minutes' },
  { value: 1 * HOUR, label: '1 hour' },
  { value: 6 * DAY, label: '6 days' },
  { value: 3 * WEEK, label: '3 weeks' },
];
