// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ParsedJob } from './types.std.ts';

/**
 * A single job instance. Shouldn't be instantiated directly, except by `JobQueue`.
 */
export class Job<T> implements ParsedJob<T> {
  public readonly id: string;
  public readonly timestamp: number;
  public readonly queueType: string;
  public readonly data: T;
  public readonly completion: Promise<void>;

  constructor(
    id: string,
    timestamp: number,
    queueType: string,
    data: T,
    completion: Promise<void>
  ) {
    this.id = id;
    this.timestamp = timestamp;
    this.queueType = queueType;
    this.data = data;
    this.completion = completion;
  }
}
