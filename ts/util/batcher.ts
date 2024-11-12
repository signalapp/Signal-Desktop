// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import PQueue from 'p-queue';

import { sleep } from './sleep';
import * as log from '../logging/log';
import * as Errors from '../types/errors';
import { clearTimeoutIfNecessary } from './clearTimeoutIfNecessary';
import { MINUTE } from './durations';
import { drop } from './drop';

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
  log.info('batcher#waitForAllBatchers');
  try {
    await Promise.all(window.batchers.map(item => item.flushAndWait()));
  } catch (error) {
    log.error(
      'waitForAllBatchers: error flushing all',
      Errors.toLogFormat(error)
    );
  }
};

export type BatcherOptionsType<ItemType> = {
  name: string;
  wait: number | (() => number);
  maxSize: number;
  processBatch: (items: Array<ItemType>) => void | Promise<void>;
};

export type BatcherType<ItemType> = {
  add: (item: ItemType) => void;
  removeAll: (needle: ItemType) => void;
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

  const queue = new PQueue({
    concurrency: 1,
    timeout: MINUTE * 30,
    throwOnTimeout: true,
  });

  function _getWait() {
    if (typeof options.wait === 'number') {
      return options.wait;
    }
    return options.wait();
  }

  function _kickBatchOff() {
    clearTimeoutIfNecessary(timeout);
    timeout = null;

    const itemsRef = items;
    items = [];
    drop(
      queue.add(async () => {
        await options.processBatch(itemsRef);
      })
    );
  }

  function add(item: ItemType) {
    items.push(item);

    if (items.length === 1) {
      // Set timeout once when we just pushed the first item so that the wait
      // time is bounded by `options.wait` and not extended by further pushes.
      timeout = setTimeout(_kickBatchOff, _getWait());
    } else if (items.length >= options.maxSize) {
      _kickBatchOff();
    }
  }

  function removeAll(needle: ItemType) {
    items = items.filter(item => item !== needle);
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
        await sleep(_getWait() * 2);
      }
    }
  }

  function unregister() {
    window.batchers = window.batchers.filter(item => item !== batcher);
  }

  async function flushAndWait() {
    log.info(`Flushing ${options.name} batcher items.length=${items.length}`);

    while (anyPending()) {
      _kickBatchOff();

      if (queue.size > 0 || queue.pending > 0) {
        // eslint-disable-next-line no-await-in-loop
        await queue.onIdle();
      }
    }
    log.info(`Flushing complete ${options.name} for batcher`);
  }

  batcher = {
    add,
    removeAll,
    anyPending,
    onIdle,
    flushAndWait,
    unregister,
  };

  window.batchers.push(batcher);

  return batcher;
}
