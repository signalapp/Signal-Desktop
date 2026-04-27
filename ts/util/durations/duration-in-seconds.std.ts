// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as Constants from './constants.std.ts';

export type DurationInSeconds = number & {
  __time_difference_in_seconds: never;
};

export namespace DurationInSeconds {
  export const fromMillis = (ms: number): DurationInSeconds =>
    (ms / Constants.SECOND) as DurationInSeconds;
  export const fromSeconds = (seconds: number): DurationInSeconds =>
    seconds as DurationInSeconds;
  export const fromMinutes = (m: number): DurationInSeconds =>
    ((m * Constants.MINUTE) / Constants.SECOND) as DurationInSeconds;
  export const fromHours = (h: number): DurationInSeconds =>
    ((h * Constants.HOUR) / Constants.SECOND) as DurationInSeconds;
  export const fromDays = (d: number): DurationInSeconds =>
    ((d * Constants.DAY) / Constants.SECOND) as DurationInSeconds;
  export const fromWeeks = (d: number): DurationInSeconds =>
    ((d * Constants.WEEK) / Constants.SECOND) as DurationInSeconds;
  export const fromMonths = (d: number): DurationInSeconds =>
    ((d * Constants.MONTH) / Constants.SECOND) as DurationInSeconds;

  export const toSeconds = (d: DurationInSeconds): number => d;
  export const toMillis = (d: DurationInSeconds): number =>
    d * Constants.SECOND;
  export const toHours = (d: DurationInSeconds): number =>
    (d * Constants.SECOND) / Constants.HOUR;

  export const ZERO = fromSeconds(0);
  export const HOUR = fromHours(1);
  export const MINUTE = fromMinutes(1);
  export const DAY = fromDays(1);
  export const WEEK = fromWeeks(1);
}
