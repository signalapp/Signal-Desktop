// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ParsedJob } from './types.std.js';

/**
 * A single job instance. Shouldn't be instantiated directly, except by `JobQueue`.
 */
export class Job<T> implements ParsedJob<T> {
  constructor(
    readonly id: string,
    readonly timestamp: number,
    readonly queueType: string,
    readonly data: T,
    readonly completion: Promise<void>
  ) {}
}
