/* global clearTimeout */
// was timeoutDelay
const sleepFor = ms => new Promise(resolve => setTimeout(resolve, ms));

let log;
function configure(options = {}) {
  ({ log } = options);
}

// Taken from https://stackoverflow.com/questions/51160260/clean-way-to-wait-for-first-true-returned-by-promise
// The promise returned by this function will resolve true when the first promise
// in ps resolves true *or* it will resolve false when all of ps resolve false
const firstTrue = ps => {
  const newPs = ps.map(
    p =>
      new Promise(
        // eslint-disable-next-line more/no-then
        (resolve, reject) => p.then(v => v && resolve(v), reject)
      )
  );
  // eslint-disable-next-line more/no-then
  newPs.push(Promise.all(ps).then(() => false));
  return Promise.race(newPs);
};

// one action resolves all
const snodeGlobalLocks = {};
async function allowOnlyOneAtATime(name, process, timeout) {
  // if currently not in progress
  if (snodeGlobalLocks[name] === undefined) {
    // set lock
    snodeGlobalLocks[name] = new Promise(async (resolve, reject) => {
      // set up timeout feature
      let timeoutTimer = null;
      if (timeout) {
        timeoutTimer = setTimeout(() => {
          log.warn(
            `loki_primitives:::allowOnlyOneAtATime - TIMEDOUT after ${timeout}s`
          );
          delete snodeGlobalLocks[name]; // clear lock
          reject();
        }, timeout);
      }
      // do actual work
      let innerRetVal;
      try {
        innerRetVal = await process();
      } catch (e) {
        log.error(
          `loki_primitives:::allowOnlyOneAtATime - error ${e.code} ${e.message}`
        );
        // clear timeout timer
        if (timeout) {
          if (timeoutTimer !== null) {
            clearTimeout(timeoutTimer);
            timeoutTimer = null;
          }
        }
        delete snodeGlobalLocks[name]; // clear lock
        throw e;
      }
      // clear timeout timer
      if (timeout) {
        if (timeoutTimer !== null) {
          clearTimeout(timeoutTimer);
          timeoutTimer = null;
        }
      }
      delete snodeGlobalLocks[name]; // clear lock
      // release the kraken
      resolve(innerRetVal);
    });
  }
  let outerRetval;
  // handle any timeouts
  try {
    outerRetval = await snodeGlobalLocks[name];
  } catch (e) {
    // we will throw for each time allowOnlyOneAtATime has been called in parallel
    log.error(
      'loki_primitives:::allowOnlyOneAtATime - error',
      e.code,
      e.message
    );
    throw e;
  }
  return outerRetval;
}

function abortableIterator(array, iterator) {
  let abortIteration = false;

  // for the control promise
  let controlResolveFunctor;
  const stopPolling = new Promise(res => {
    // store resolve functor
    controlResolveFunctor = res;
  });

  // eslint-disable-next-line more/no-then
  stopPolling.then(() => {
    abortIteration = true;
  });

  const destructableList = [...array];
  const accum = [];

  return {
    start: async serially => {
      let item = destructableList.pop();
      while (item && !abortIteration) {
        if (serially) {
          try {
            // eslint-disable-next-line no-await-in-loop
            accum.push(await iterator(item));
          } catch (e) {
            log.error(
              `loki_primitives:::abortableIterator - error ${e.code} ${e.message}`
            );
            throw e;
          }
        } else {
          accum.push(iterator(item));
        }
        item = destructableList.pop();
      }
      return accum;
    },
    stop: () => {
      /*
      log.debug('loki_primitives:::abortableIterator - Stopping',
                destructableList.length, '+', accum.length, '=', array.length,
                'aborted?', abortIteration);
      */
      controlResolveFunctor();
    },
  };
}

module.exports = {
  configure,
  sleepFor,
  allowOnlyOneAtATime,
  abortableIterator,
  firstTrue,
};
