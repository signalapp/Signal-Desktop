// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export default function createTaskWithTimeout<T>(
  task: () => Promise<T>,
  id: string,
  options: { timeout?: number } = {}
): () => Promise<T> {
  const timeout = options.timeout || 1000 * 60 * 2; // two minutes

  const errorForStack = new Error('for stack');

  return async () =>
    new Promise((resolve, reject) => {
      let complete = false;
      let timer: NodeJS.Timeout | null = setTimeout(() => {
        if (!complete) {
          const message = `${id ||
            ''} task did not complete in time. Calling stack: ${
            errorForStack.stack
          }`;

          window.log.error(message);
          reject(new Error(message));

          return undefined;
        }

        return null;
      }, timeout);
      const clearTimer = () => {
        try {
          const localTimer = timer;
          if (localTimer) {
            timer = null;
            clearTimeout(localTimer);
          }
        } catch (error) {
          window.log.error(
            id || '',
            'task ran into problem canceling timer. Calling stack:',
            errorForStack.stack
          );
        }
      };

      const success = (result: T) => {
        clearTimer();
        complete = true;
        resolve(result);
      };
      const failure = (error: Error) => {
        clearTimer();
        complete = true;
        reject(error);
      };

      let promise;
      try {
        promise = task();
      } catch (error) {
        clearTimer();
        throw error;
      }
      if (!promise || !promise.then) {
        clearTimer();
        complete = true;
        resolve(promise);

        return undefined;
      }

      // eslint-disable-next-line more/no-then
      return promise.then(success, failure);
    });
}
