/* global clearTimeout, log */
// was timeoutDelay
const sleepFor = ms => new Promise(resolve => setTimeout(resolve, ms));

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
  outerRetval = await snodeGlobalLocks[name];
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
          // eslint-disable-next-line no-await-in-loop
          accum.push(await iterator(item));
        } else {
          accum.push(iterator(item));
        }
        item = destructableList.pop();
      }
      return accum;
    },
    stop: () => {
      controlResolveFunctor();
    },
  };
}

module.exports = {
  sleepFor,
  allowOnlyOneAtATime,
  abortableIterator,
  firstTrue,
};
