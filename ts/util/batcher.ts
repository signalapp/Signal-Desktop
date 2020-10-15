import PQueue from 'p-queue';

declare global {
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
  wait: number;
  maxSize: number;
  processBatch: (items: Array<ItemType>) => Promise<void>;
};

export type BatcherType<ItemType> = {
  add: (item: ItemType) => void;
  anyPending: () => boolean;
  onIdle: () => Promise<void>;
  flushAndWait: () => Promise<void>;
  unregister: () => void;
};

async function sleep(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

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
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    if (items.length) {
      _kickBatchOff();
    }

    return onIdle();
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
