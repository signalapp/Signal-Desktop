// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import PQueue from 'p-queue';

import { sleep } from './sleep';

declare global {
  // We want to extend `window`'s properties, so we need an interface.
  // eslint-disable-next-line no-restricted-syntax
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    batchers: Array<BatcherType<any>>;
    waitForAllBatchers: () => Promise<unknown>;
  }
}

window.batchers = [];

window.waitForAllBatchers = async () => {
  await Promise.all(window.batchers.map(item => item.flushAndWait()));
};

export type BatcherOptionsType<ItemType> = {
  name: string;
  wait: number;
  maxSize: number;
  processBatch: (items: Array<ItemType>) => void | Promise<void>;
};

export type BatcherType<ItemType> = {
  add: (item: ItemType) => void;
  anyPending: () => boolean;
  onIdle: () => Promise<void>;
  flushAndWait: () => Promise<void>;
  unregister: () => void;
};

export function createBatcher<ItemType>(
  options: BatcherOptionsType<ItemType>
): BatcherType<ItemType> {
  let batcher: BatcherType<ItemType>;
  let timeout: NodeJS.Timeout | null;
  let items: Array<ItemType> = [];
  const queue = new PQueue({ concurrency: 1, timeout: 1000 * 60 * 2 });

  function _kickBatchOff() {
    const itemsRef = items;
    items = [];
    queue.add(async () => {
      await options.processBatch(itemsRef);
    });
  }

  function add(item: ItemType) {
    items.push(item);

    if (items.length === 1) {
      // Set timeout once when we just pushed the first item so that the wait
      // time is bounded by `options.wait` and not extended by further pushes.
      timeout = setTimeout(() => {
        timeout = null;
        _kickBatchOff();
      }, options.wait);
    } else if (items.length >= options.maxSize) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      _kickBatchOff();
    }
  }

  function anyPending(): boolean {
    return queue.size > 0 || queue.pending > 0 || items.length > 0;
  }

  async function onIdle() {
    while (anyPending()) {
      if (queue.size > 0 || queue.pending > 0) {
        // eslint-disable-next-line no-await-in-loop
        await queue.onIdle();
      }

      if (items.length > 0) {
        // eslint-disable-next-line no-await-in-loop
        await sleep(options.wait * 2);
      }
    }
  }

  function unregister() {
    window.batchers = window.batchers.filter(item => item !== batcher);
  }

  async function flushAndWait() {
    window.log.info(
      `Flushing ${options.name} batcher items.length=${items.length}`
    );
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }

    while (anyPending()) {
      _kickBatchOff();

      if (queue.size > 0 || queue.pending > 0) {
        // eslint-disable-next-line no-await-in-loop
        await queue.onIdle();
      }
    }
    window.log.info(`Flushing complete ${options.name} for batcher`);
  }

  batcher = {
    add,
    anyPending,
    onIdle,
    flushAndWait,
    unregister,
  };

  window.batchers.push(batcher);

  return batcher;
}
