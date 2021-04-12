// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export class StartupQueue {
  set: Set<string>;

  items: Array<() => void>;

  constructor() {
    this.set = new Set();
    this.items = [];
  }

  add(id: string, f: () => void): void {
    if (this.set.has(id)) {
      return;
    }

    this.items.push(f);
    this.set.add(id);
  }

  flush(): void {
    const { items } = this;
    window.log.info('StartupQueue: Processing', items.length, 'actions');
    items.forEach(f => f());
    this.items = [];
    this.set.clear();
  }
}
