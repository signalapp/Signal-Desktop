// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import moment from 'moment';

import { HOUR } from './durations/constants.std.ts';

const HOUR_IN_SECONDS = 60 * 60;

export function formatDuration(seconds: number): string {
  const time = moment.utc(seconds * 1000);

  if (seconds >= HOUR_IN_SECONDS) {
    return time.format('H:mm:ss');
  }

  return time.format('m:ss');
}

export function formatDurationInMs(ms: number): string {
  const time = moment.utc(ms);

  if (ms >= HOUR) {
    return time.format('H:mm:ss');
  }

  return time.format('m:ss');
}
