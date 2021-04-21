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
  abortableIterator,
  firstTrue,
};
