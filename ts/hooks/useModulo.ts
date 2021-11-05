import React from 'react';
// tslint:disable-next-line: no-submodule-imports
import useInterval from 'react-use/lib/useInterval';

export function useModulo(loopBackAt: number, delay: number) {
  const [count, setCount] = React.useState(0);

  useInterval(() => {
    if (count >= loopBackAt) {
      setCount(0);
    } else {
      setCount(count + 1);
    }
  }, delay);
  return { count };
}
