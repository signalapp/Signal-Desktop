function consolidateLists(lists, threshold = 1){
  if (typeof threshold !== 'number') {
    throw Error('Provided threshold is not a number');
  }

  // calculate list size manually since `Set`
  // does not have a `length` attribute
  let listSize = 0;
  const occurences = {};
  lists.forEach(list => {
    listSize += 1;
    list.forEach(item => {
      if (!(item in occurences)) {
        occurences[item] = 1;
      } else {
        occurences[item] += 1;
      }
    });
  });

  const scaledThreshold = listSize * threshold;
  return Object.entries(occurences)
    .filter(keyValue => keyValue[1] >= scaledThreshold)
    .map(keyValue => keyValue[0]);
}

module.exports = {
  consolidateLists,
}
