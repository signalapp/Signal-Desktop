/* global window */

// eslint-disable-next-line func-names
(function () {
  window.libloki = window.libloki || {};
  window.libloki.serviceNodes = window.libloki.serviceNodes || {};

  function consolidateLists(lists, threshold = 1){
    if (typeof threshold !== 'number') {
      throw Error('Provided threshold is not a number');
    }

    // calculate list size manually since `Set`
    // does not have a `length` attribute
    let numLists = 0;
    const occurences = {};
    lists.forEach(list => {
      numLists += 1;
      list.forEach(item => {
        if (!(item in occurences)) {
          occurences[item] = 1;
        } else {
          occurences[item] += 1;
        }
      });
    });

    const scaledThreshold = numLists * threshold;
    return Object.entries(occurences)
      .filter(keyValue => keyValue[1] >= scaledThreshold)
      .map(keyValue => keyValue[0]);
  }

  window.libloki.serviceNodes.consolidateLists = consolidateLists;
})();
