// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import PQueue from 'p-queue';

import { sleep } from './sleep';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    waitBatchers: Array<BatcherType<any>>;
    waitForAllWaitBatchers: () => Promise<unknown>;
  }
}

window.waitBatchers = [];

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
  wait: number;
  maxSize: number;
  processBatch: (items: Array<ItemType>) => Promise<void>;
};

type BatcherType<ItemType> = {
  add: (item: ItemType) => Promise<void>;
  anyPending: () => boolean;
  onIdle: () => Promise<void>;
  unregister: () => void;
};

export function createWaitBatcher<ItemType>(
  options: BatcherOptionsType<ItemType>
): BatcherType<ItemType> {
  let waitBatcher: BatcherType<ItemType>;
  let timeout: NodeJS.Timeout | null;
  let items: Array<ItemHolderType<ItemType>> = [];
  const queue = new PQueue({ concurrency: 1, timeout: 1000 * 60 * 2 });

  function _kickBatchOff() {
    const itemsRef = items;
    items = [];
    queue.add(async () => {
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

    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }

    if (items.length >= options.maxSize) {
      _kickBatchOff();
    } else {
      timeout = setTimeout(() => {
        timeout = null;
        _kickBatchOff();
      }, options.wait);
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

  waitBatcher = {
    add,
    anyPending,
    onIdle,
    unregister,
  };

  window.waitBatchers.push(waitBatcher);

  return waitBatcher;
}
