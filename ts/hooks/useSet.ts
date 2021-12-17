import { useCallback, useState } from 'react';
import _ from 'lodash';

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
      setUniqueValues(uniqueValues.filter(v => !_.isEqual(v, valueToRemove)));
    },
    [uniqueValues, setUniqueValues]
  );

  return { uniqueValues, addTo, removeFrom };
}
