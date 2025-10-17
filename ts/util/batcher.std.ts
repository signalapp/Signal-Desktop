// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import PQueue from 'p-queue';

import { sleep } from './sleep.std.js';
import { createLogger } from '../logging/log.std.js';
import * as Errors from '../types/errors.std.js';
import { clearTimeoutIfNecessary } from './clearTimeoutIfNecessary.std.js';
import { MINUTE } from './durations/index.std.js';
import { drop } from './drop.std.js';

const log = createLogger('batcher');

let batchers = new Array<BatcherType<unknown>>();

export const waitForAllBatchers = async (): Promise<void> => {
  log.info('waitForAllBatchers');
  try {
    await Promise.all(batchers.map(item => item.flushAndWait()));
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
    batchers = batchers.filter(item => item !== batcher);
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

  batchers.push(batcher as BatcherType<unknown>);

  return batcher;
}
