// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import PQueue from 'p-queue';

import { sleep } from './sleep';
import * as log from '../logging/log';
import * as Errors from '../types/errors';
import { clearTimeoutIfNecessary } from './clearTimeoutIfNecessary';
import { MINUTE } from './durations';
import { drop } from './drop';
import { explodePromise } from './explodePromise';

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
  log.info('waitBatcher#flushAllWaitBatchers');
  try {
    await Promise.all(window.waitBatchers.map(item => item.flushAndWait()));
  } catch (error) {
    log.error(
      'flushAllWaitBatchers: Error flushing all',
      Errors.toLogFormat(error)
    );
  }
};

window.waitForAllWaitBatchers = async () => {
  log.info('waitBatcher#waitForAllWaitBatchers');
  try {
    await Promise.all(window.waitBatchers.map(item => item.onIdle()));
  } catch (error) {
    log.error(
      'waitForAllWaitBatchers: Error waiting for all',
      Errors.toLogFormat(error)
    );
  }
};

type ItemHolderType<ItemType> = {
  resolve?: (value?: unknown) => void;
  reject?: (error: Error) => void;
  item: ItemType;
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
  flushAndWait: () => Promise<void>;
  pushNoopAndWait: () => Promise<void>;
};

export function createWaitBatcher<ItemType>(
  options: BatcherOptionsType<ItemType>
): BatcherType<ItemType> {
  let waitBatcher: BatcherType<ItemType>;
  let timeout: NodeJS.Timeout | null;
  let items: Array<ItemHolderType<ItemType>> = [];
  const queue = new PQueue({
    concurrency: 1,
    timeout: MINUTE * 30,
    throwOnTimeout: true,
  });

  async function _kickBatchOff() {
    if (items.length === 0) {
      return;
    }

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

  async function add(item: ItemType) {
    const { promise, resolve, reject } = explodePromise();

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
        drop(_kickBatchOff());
      }, options.wait);
    }
    if (items.length >= options.maxSize) {
      clearTimeoutIfNecessary(timeout);
      timeout = null;

      drop(_kickBatchOff());
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

  // Meant for a full shutdown of the queue
  async function flushAndWait() {
    log.info(
      `Flushing start ${options.name} for waitBatcher ` +
        `items.length=${items.length}`
    );
    clearTimeoutIfNecessary(timeout);
    timeout = null;

    while (anyPending()) {
      // eslint-disable-next-line no-await-in-loop
      await _kickBatchOff();

      if (queue.size > 0 || queue.pending > 0) {
        // eslint-disable-next-line no-await-in-loop
        await queue.onIdle();
      }
    }

    log.info(`Flushing complete ${options.name} for waitBatcher`);
  }

  // Meant to let us know that we've processed jobs up to a point
  async function pushNoopAndWait() {
    log.info(
      `Pushing no-op to ${options.name} for waitBatcher ` +
        `items.length=${items.length}`
    );

    clearTimeoutIfNecessary(timeout);
    timeout = null;

    drop(_kickBatchOff());

    return queue.add(() => {
      /* noop */
    });
  }

  waitBatcher = {
    add,
    anyPending,
    onIdle,
    unregister,
    flushAndWait,
    pushNoopAndWait,
  };

  window.waitBatchers.push(waitBatcher);

  return waitBatcher;
}
