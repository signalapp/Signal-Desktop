import PQueue from 'p-queue';

// @ts-ignore
window.batchers = [];

// @ts-ignore
window.waitForAllBatchers = async () => {
  // @ts-ignore
  await Promise.all(window.batchers.map(item => item.flushAndWait()));
};

type BatcherOptionsType<ItemType> = {
  wait: number;
  maxSize: number;
  processBatch: (items: Array<ItemType>) => Promise<void>;
};

type BatcherType<ItemType> = {
  add: (item: ItemType) => void;
  anyPending: () => boolean;
  onIdle: () => Promise<void>;
  flushAndWait: () => Promise<void>;
  unregister: () => void;
};

async function sleep(ms: number): Promise<void> {
  // tslint:disable-next-line:no-string-based-set-timeout
  await new Promise(resolve => setTimeout(resolve, ms));
}

export function createBatcher<ItemType>(
  options: BatcherOptionsType<ItemType>
): BatcherType<ItemType> {
  let batcher: BatcherType<ItemType>;
  let timeout: any;
  let items: Array<ItemType> = [];
  const queue = new PQueue({ concurrency: 1 });

  function _kickBatchOff() {
    const itemsRef = items;
    items = [];
    // tslint:disable-next-line:no-floating-promises
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
        await queue.onIdle();
      }

      if (items.length > 0) {
        await sleep(options.wait * 2);
      }
    }
  }

  function unregister() {
    // @ts-ignore
    window.batchers = window.batchers.filter((item: any) => item !== batcher);
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

  // @ts-ignore
  window.batchers.push(batcher);

  return batcher;
}
