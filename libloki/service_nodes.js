/* global window */

// eslint-disable-next-line func-names
(function() {
  window.libloki = window.libloki || {};

  function consolidateLists(lists, threshold, selector = x => x) {
    if (typeof threshold !== 'number') {
      throw Error('Provided threshold is not a number');
    }
    if (typeof selector !== 'function') {
      throw Error('Provided selector is not a function');
    }

    // calculate list size manually since `Set`
    // does not have a `length` attribute
    let numLists = 0;
    const occurences = {};
    const values = {};
    lists.forEach(list => {
      numLists += 1;
      list.forEach(item => {
        const key = selector(item);
        if (!(key in occurences)) {
          occurences[key] = 1;
          values[key] = item;
        } else {
          occurences[key] += 1;
        }
      });
    });

    const scaledThreshold = numLists * threshold;
    return Object.keys(occurences)
      .filter(key => occurences[key] >= scaledThreshold)
      .map(key => values[key]);
  }

  window.libloki.serviceNodes = {
    consolidateLists,
  };
})();
