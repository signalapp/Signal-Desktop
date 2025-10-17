// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import PQueue from 'p-queue';

import { MINUTE } from './durations/index.std.js';

const MAX_CONCURRENCY = 5;

export async function waitForAll<T>({
  tasks,
  maxConcurrency = MAX_CONCURRENCY,
}: {
  tasks: Array<() => Promise<T>>;
  maxConcurrency?: number;
}): Promise<Array<T>> {
  const queue = new PQueue({
    concurrency: maxConcurrency,
    timeout: MINUTE * 30,
    throwOnTimeout: true,
  });
  return queue.addAll(tasks);
}
