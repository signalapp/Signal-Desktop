// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LRUCache } from 'lru-cache';

export type WaveformCache = LRUCache<
  string,
  {
    duration: number;
    peaks: ReadonlyArray<number>;
  }
>;
