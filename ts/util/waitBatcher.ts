import PQueue from 'p-queue';

// @ts-ignore
window.waitBatchers = [];

// @ts-ignore
window.waitForAllWaitBatchers = async () => {
  // @ts-ignore
  await Promise.all(window.waitBatchers.map(item => item.onIdle()));
};

type ItemHolderType<ItemType> = {
  resolve: (value?: any) => void;
  reject: (error: Error) => void;
  item: ItemType;
};

type ExplodedPromiseType = {
  resolve: (value?: any) => void;
  reject: (error: Error) => void;
  promise: Promise<any>;
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

async function sleep(ms: number): Promise<void> {
  // tslint:disable-next-line:no-string-based-set-timeout
  await new Promise(resolve => setTimeout(resolve, ms));
}

export function createWaitBatcher<ItemType>(
  options: BatcherOptionsType<ItemType>
): BatcherType<ItemType> {
  let waitBatcher: BatcherType<ItemType>;
  let timeout: any;
  let items: Array<ItemHolderType<ItemType>> = [];
  const queue = new PQueue({ concurrency: 1 });

  function _kickBatchOff() {
    const itemsRef = items;
    items = [];
    // tslint:disable-next-line:no-floating-promises
    queue.add(async () => {
      try {
        await options.processBatch(itemsRef.map(item => item.item));
        itemsRef.forEach(item => {
          item.resolve();
        });
      } catch (error) {
        itemsRef.forEach(item => {
          item.reject(error);
        });
      }
    });
  }

  function _makeExplodedPromise(): ExplodedPromiseType {
    let resolve;
    let reject;

    // tslint:disable-next-line:promise-must-complete
    const promise = new Promise((resolveParam, rejectParam) => {
      resolve = resolveParam;
      reject = rejectParam;
    });

    // @ts-ignore
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
        await queue.onIdle();
      }

      if (items.length > 0) {
        await sleep(options.wait * 2);
      }
    }
  }

  function unregister() {
    // @ts-ignore
    window.waitBatchers = window.waitBatchers.filter(
      (item: any) => item !== waitBatcher
    );
  }

  waitBatcher = {
    add,
    anyPending,
    onIdle,
    unregister,
  };

  // @ts-ignore
  window.waitBatchers.push(waitBatcher);

  return waitBatcher;
}
