// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { memoryUsage } from 'node:process';

import { createLogger } from '../logging/log.std.ts';
import { MINUTE } from './durations/index.std.ts';

const log = createLogger('oomNotifier');

const INTERVAL = 5 * MINUTE;

const HEAP_SIZE_THRESHOLD = 1024 * 1024 * 1024;

export function trackHeapSize(callback?: () => void): void {
  const timer = setInterval(() => {
    const usage = memoryUsage();
    if (usage.heapTotal < HEAP_SIZE_THRESHOLD) {
      return;
    }

    log.error('high memory usage', usage);
    callback?.();
    clearInterval(timer);
  }, INTERVAL);
}
