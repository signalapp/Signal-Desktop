import { useState } from 'react';
import useInterval from 'react-use/lib/useInterval';

export function useModulo(loopBackAt: number, delay: number) {
  const [count, setCount] = useState(0);

  useInterval(() => {
    if (count >= loopBackAt) {
      setCount(0);
    } else {
      setCount(count + 1);
    }
  }, delay);
  return { count };
}
