// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as durations from '../util/durations/index.std.js';
import { DurationInSeconds } from '../util/durations/index.std.js';

export type TestExpireTimer = Readonly<{
  value: DurationInSeconds;
  label: string;
}>;

export const EXPIRE_TIMERS: ReadonlyArray<TestExpireTimer> = [
  { value: 42 * durations.SECOND, label: '42 seconds' },
  { value: 5 * durations.MINUTE, label: '5 minutes' },
  { value: 1 * durations.HOUR, label: '1 hour' },
  { value: 6 * durations.DAY, label: '6 days' },
  { value: 3 * durations.WEEK, label: '3 weeks' },
].map(({ value, label }) => {
  return {
    value: DurationInSeconds.fromMillis(value),
    label,
  };
});
