type SimpleFunction<T> = (arg: T) => void;
type Return<T> = Promise<T> | T;

async function toPromise<T>(value: Return<T>): Promise<T> {
  return value instanceof Promise ? value : Promise.resolve(value);
}

export class TaskTimedOutError extends Error {
  constructor() {
    super('Task timed out');
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, TaskTimedOutError.prototype);
  }
}

// one action resolves all
const snodeGlobalLocks: Record<string, Promise<any>> = {};
export async function allowOnlyOneAtATime(
  name: string,
  process: () => Promise<any>,
  timeoutMs?: number
) {
  // if currently not in progress
  if (snodeGlobalLocks[name] === undefined) {
    // set lock
    snodeGlobalLocks[name] = new Promise(async (resolve, reject) => {
      // set up timeout feature
      let timeoutTimer = null;
      if (timeoutMs) {
        timeoutTimer = setTimeout(() => {
          window.log.warn(`loki_primitives:::allowOnlyOneAtATime - TIMEDOUT after ${timeoutMs}s`);
          // tslint:disable-next-line: no-dynamic-delete
          delete snodeGlobalLocks[name]; // clear lock
          reject();
        }, timeoutMs);
      }
      // do actual work
      let innerRetVal;
      try {
        innerRetVal = await process();
      } catch (e) {
        if (typeof e === 'string') {
          window.log.error(`loki_primitives:::allowOnlyOneAtATime - error ${e}`);
        } else {
          window.log.error(`loki_primitives:::allowOnlyOneAtATime - error ${e.code} ${e.message}`);
        }

        // clear timeout timer
        if (timeoutMs) {
          if (timeoutTimer !== null) {
            clearTimeout(timeoutTimer);
            timeoutTimer = null;
          }
        }
        // tslint:disable-next-line: no-dynamic-delete
        delete snodeGlobalLocks[name]; // clear lock
        throw e;
      }
      // clear timeout timer
      if (timeoutMs) {
        if (timeoutTimer !== null) {
          clearTimeout(timeoutTimer);
          timeoutTimer = null;
        }
      }
      // tslint:disable-next-line: no-dynamic-delete
      delete snodeGlobalLocks[name]; // clear lock
      // release the kraken
      resolve(innerRetVal);
    });
  } else {
  }
  return snodeGlobalLocks[name];
}

/**
 * Create a promise which waits until `done` is called or until `timeout` period is reached.
 * If `timeout` is reached then this will throw an Error.
 *
 * @param task The task to wait for.
 * @param timeout The timeout period.
 */
export async function waitForTask<T>(
  task: (done: SimpleFunction<T>) => Return<void>,
  timeoutMs: number = 2000
): Promise<T> {
  const timeoutPromise = new Promise<T>((_, rej) => {
    const wait = setTimeout(() => {
      clearTimeout(wait);
      rej(new TaskTimedOutError());
    }, timeoutMs);
  });

  const taskPromise = new Promise(async (res, rej) => {
    try {
      await toPromise(task(res));
    } catch (e) {
      rej(e);
    }
  });

  return Promise.race([timeoutPromise, taskPromise]) as Promise<T>;
}

export interface PollOptions {
  timeoutMs: number;
  interval: number;
}

/**
 * Creates a promise which calls the `task` every `interval` until `done` is called or until `timeout` period is reached.
 * If `timeout` is reached then this will throw an Error.
 *
 * @param task The task which runs every `interval` ms.
 * @param options The polling options.
 */
export async function poll(
  task: (done: SimpleFunction<void>) => Return<void>,
  options: Partial<PollOptions> = {}
): Promise<void> {
  const defaults: PollOptions = {
    timeoutMs: 2000,
    interval: 100,
  };

  const { timeoutMs, interval } = {
    ...defaults,
    ...options,
  };

  const endTime = Date.now() + timeoutMs;
  let stop = false;
  const finish = () => {
    stop = true;
  };

  const _poll = async (resolve: any, reject: any) => {
    if (stop) {
      resolve();
    } else if (Date.now() >= endTime) {
      finish();
      reject(new Error('Periodic check timeout'));
    } else {
      try {
        await toPromise(task(finish));
      } catch (e) {
        finish();
        reject(e);
        return;
      }

      setTimeout(() => {
        void _poll(resolve, reject);
      }, interval);
    }
  };

  return new Promise((resolve, reject) => {
    void _poll(resolve, reject);
  });
}

/**
 * Creates a promise which waits until `check` returns `true` or rejects if `timeout` preiod is reached.
 * If `timeout` is reached then this will throw an Error.
 *
 * @param check The boolean check.
 * @param timeout The time before an error is thrown.
 */
export async function waitUntil(check: () => Return<boolean>, timeoutMs: number = 2000) {
  // This is causing unhandled promise rejection somewhere in MessageQueue tests
  return poll(
    async done => {
      const result = await toPromise(check());
      if (result) {
        done();
      }
    },
    {
      timeoutMs,
      interval: timeoutMs / 20,
    }
  );
}

export async function timeout<T>(promise: Promise<T>, timeoutMs: number = 2000): Promise<T> {
  const timeoutPromise = new Promise<T>((_, rej) => {
    const wait = setTimeout(() => {
      clearTimeout(wait);
      rej(new TaskTimedOutError());
    }, timeoutMs);
  });

  return Promise.race([timeoutPromise, promise]);
}

export async function delay(timeoutMs: number = 2000): Promise<Boolean> {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(true);
    }, timeoutMs);
  });
}
