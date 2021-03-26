// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import PQueue from 'p-queue';

import { sleep } from './sleep';

declare global {
  // We want to extend `window`'s properties, so we need an interface.
  // eslint-disable-next-line no-restricted-syntax
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    waitBatchers: Array<BatcherType<any>>;
    waitForAllWaitBatchers: () => Promise<unknown>;
    flushAllWaitBatchers: () => Promise<unknown>;
  }
}

window.waitBatchers = [];

window.flushAllWaitBatchers = async () => {
  await Promise.all(window.waitBatchers.map(item => item.flushAndWait()));
};

window.waitForAllWaitBatchers = async () => {
  await Promise.all(window.waitBatchers.map(item => item.onIdle()));
};

type ItemHolderType<ItemType> = {
  resolve?: (value?: unknown) => void;
  reject?: (error: Error) => void;
  item: ItemType;
};

type ExplodedPromiseType = {
  resolve?: (value?: unknown) => void;
  reject?: (error: Error) => void;
  promise: Promise<unknown>;
};

type BatcherOptionsType<ItemType> = {
  name: string;
  wait: number;
  maxSize: number;
  processBatch: (items: Array<ItemType>) => Promise<void>;
};

type BatcherType<ItemType> = {
  add: (item: ItemType) => Promise<void>;
  anyPending: () => boolean;
  onIdle: () => Promise<void>;
  unregister: () => void;
  flushAndWait: () => void;
};

export function createWaitBatcher<ItemType>(
  options: BatcherOptionsType<ItemType>
): BatcherType<ItemType> {
  let waitBatcher: BatcherType<ItemType>;
  let timeout: NodeJS.Timeout | null;
  let items: Array<ItemHolderType<ItemType>> = [];
  const queue = new PQueue({ concurrency: 1, timeout: 1000 * 60 * 2 });

  async function _kickBatchOff() {
    const itemsRef = items;
    items = [];
    await queue.add(async () => {
      try {
        await options.processBatch(itemsRef.map(item => item.item));
        itemsRef.forEach(item => {
          if (item.resolve) {
            item.resolve();
          }
        });
      } catch (error) {
        itemsRef.forEach(item => {
          if (item.reject) {
            item.reject(error);
          }
        });
      }
    });
  }

  function _makeExplodedPromise(): ExplodedPromiseType {
    let resolve;
    let reject;

    const promise = new Promise((resolveParam, rejectParam) => {
      resolve = resolveParam;
      reject = rejectParam;
    });

    return { promise, resolve, reject };
  }

  async function add(item: ItemType) {
    const { promise, resolve, reject } = _makeExplodedPromise();

    items.push({
      resolve,
      reject,
      item,
    });

    if (items.length === 1) {
      // Set timeout once when we just pushed the first item so that the wait
      // time is bounded by `options.wait` and not extended by further pushes.
      timeout = setTimeout(() => {
        timeout = null;
        _kickBatchOff();
      }, options.wait);
    }
    if (items.length >= options.maxSize) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }

      _kickBatchOff();
    }

    await promise;
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
    window.waitBatchers = window.waitBatchers.filter(
      item => item !== waitBatcher
    );
  }

  async function flushAndWait() {
    window.log.info(
      `Flushing start ${options.name} for waitBatcher ` +
        `items.length=${items.length}`
    );
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }

    while (anyPending()) {
      // eslint-disable-next-line no-await-in-loop
      await _kickBatchOff();

      if (queue.size > 0 || queue.pending > 0) {
        // eslint-disable-next-line no-await-in-loop
        await queue.onIdle();
      }
    }

    window.log.info(`Flushing complete ${options.name} for waitBatcher`);
  }

  waitBatcher = {
    add,
    anyPending,
    onIdle,
    unregister,
    flushAndWait,
  };

  window.waitBatchers.push(waitBatcher);

  return waitBatcher;
}
