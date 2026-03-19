// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as durations from '../util/durations/index.std.js';
import { DurationInSeconds } from '../util/durations/index.std.js';

const { fromMillis } = DurationInSeconds;

export type TestExpireTimer = Readonly<{
  value: DurationInSeconds;
  label: string;
}>;

export const EXPIRE_TIMERS = [
  { value: fromMillis(42 * durations.SECOND), label: '42 seconds' },
  { value: fromMillis(5 * durations.MINUTE), label: '5 minutes' },
  { value: fromMillis(1 * durations.HOUR), label: '1 hour' },
  { value: fromMillis(6 * durations.DAY), label: '6 days' },
  { value: fromMillis(3 * durations.WEEK), label: '3 weeks' },
] as const satisfies ReadonlyArray<TestExpireTimer>;
