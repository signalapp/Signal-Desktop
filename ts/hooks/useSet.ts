import { useCallback, useState } from 'react';
import { isEqual } from 'lodash';

export function useSet<T>(initialValues: Array<T> = []) {
  const [uniqueValues, setUniqueValues] = useState<Array<T>>(initialValues);

  const addTo = useCallback(
    (valueToAdd: T) => {
      if (uniqueValues.includes(valueToAdd)) {
        return;
      }
      setUniqueValues([...uniqueValues, valueToAdd]);
    },
    [uniqueValues, setUniqueValues]
  );
  const removeFrom = useCallback(
    (valueToRemove: T) => {
      if (!uniqueValues.includes(valueToRemove)) {
        return;
      }
      setUniqueValues(uniqueValues.filter(v => !isEqual(v, valueToRemove)));
    },
    [uniqueValues, setUniqueValues]
  );

  const empty = useCallback(() => {
    if (uniqueValues.length) {
      setUniqueValues([]);
    }
  }, [uniqueValues, setUniqueValues]);

  return { uniqueValues, addTo, removeFrom, empty };
}
