// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable no-console */

import createDebug from 'debug';

import { Bootstrap } from '../bootstrap';

export const debug = createDebug('mock:benchmarks');

export { Bootstrap };
export { App } from '../playwright';

export type StatsType = {
  mean: number;
  stddev: number;
  [key: string]: number;
};

export const RUN_COUNT = process.env.RUN_COUNT
  ? parseInt(process.env.RUN_COUNT, 10)
  : 100;

export const GROUP_SIZE = process.env.GROUP_SIZE
  ? parseInt(process.env.GROUP_SIZE, 10)
  : 8;

export const DISCARD_COUNT = process.env.DISCARD_COUNT
  ? parseInt(process.env.DISCARD_COUNT, 10)
  : 5;

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

// Can happen if electron exits prematurely
process.on('unhandledRejection', reason => {
  console.error('Unhandled rejection:');
  console.error(reason);
  process.exit(1);
});
