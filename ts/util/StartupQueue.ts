// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as Errors from '../types/errors';
import * as log from '../logging/log';

type EntryType = Readonly<{
  value: number;
  callback(): void;
}>;

export class StartupQueue {
  private readonly map = new Map<string, EntryType>();

  public add(id: string, value: number, f: () => void): void {
    const existing = this.map.get(id);
    if (existing && existing.value >= value) {
      return;
    }

    this.map.set(id, { value, callback: f });
  }

  public flush(): void {
    log.info('StartupQueue: Processing', this.map.size, 'actions');

    const values = Array.from(this.map.values());
    this.map.clear();

    for (const { callback } of values) {
      try {
        callback();
      } catch (error) {
        log.error(
          'StartupQueue: Failed to process item due to error',
          Errors.toLogFormat(error)
        );
      }
    }
  }
}
