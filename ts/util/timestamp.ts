// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const ONE_DAY = 24 * 3600 * 1000;

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
  return timestamp - (timestamp % ONE_DAY);
}
