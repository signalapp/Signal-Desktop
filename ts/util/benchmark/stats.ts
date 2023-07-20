// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export type StatsType = {
  mean: number;
  stddev: number;
  [key: string]: number;
};

export function stats(
  list: ReadonlyArray<number>,
  percentiles: ReadonlyArray<number> = []
): StatsType {
  if (list.length === 0) {
    throw new Error('Empty list given to stats');
  }

  let mean = 0;
  let stddev = 0;

  for (const value of list) {
    mean += value;
    stddev += value ** 2;
  }
  mean /= list.length;
  stddev /= list.length;

  stddev -= mean ** 2;
  stddev = Math.sqrt(stddev);

  const sorted = list.slice().sort((a, b) => a - b);

  const result: StatsType = { mean, stddev };

  for (const p of percentiles) {
    result[`p${p}`] = sorted[Math.floor((sorted.length * p) / 100)];
  }

  return result;
}
