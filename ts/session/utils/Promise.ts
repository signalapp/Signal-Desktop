type SimpleFunction<T> = (arg: T) => void;
type Return<T> = Promise<T> | T;

async function toPromise<T>(value: Return<T>): Promise<T> {
  return value instanceof Promise ? value : Promise.resolve(value);
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
  timeout: number = 2000
): Promise<T> {
  const timeoutPromise = new Promise<T>((_, rej) => {
    const wait = setTimeout(() => {
      clearTimeout(wait);
      rej(new Error('Task timed out.'));
    }, timeout);
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
  timeout: number;
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
    timeout: 2000,
    interval: 100,
  };

  const { timeout, interval } = {
    ...defaults,
    ...options,
  };

  const endTime = Date.now() + timeout;
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
export async function waitUntil(
  check: () => Return<boolean>,
  timeout: number = 2000
) {
  // This is causing unhandled promise rejection somewhere in MessageQueue tests
  return poll(
    async done => {
      const result = await toPromise(check());
      if (result) {
        done();
      }
    },
    {
      timeout,
      interval: timeout / 20,
    }
  );
}
