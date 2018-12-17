/* global window */

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  window.textsecure = window.textsecure || {};

  window.textsecure.createTaskWithTimeout = (task, id, options = {}) => {
    const timeout = options.timeout || 1000 * 60 * 3; // three minutes

    const errorForStack = new Error('for stack');
    return () =>
      new Promise((resolve, reject) => {
        let complete = false;
        let timer = setTimeout(() => {
          if (!complete) {
            const message = `${id ||
              ''} task did not complete in time. Calling stack: ${
              errorForStack.stack
            }`;

            window.log.error(message);
            return reject(new Error(message));
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

        const success = result => {
          clearTimer();
          complete = true;
          return resolve(result);
        };
        const failure = error => {
          clearTimer();
          complete = true;
          return reject(error);
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
          return resolve(promise);
        }

        return promise.then(success, failure);
      });
  };
})();
