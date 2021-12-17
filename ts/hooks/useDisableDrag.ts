import { useCallback } from 'react';

/**
 * This memoized function just returns a callback which can be used to disable the onDragStart event
 */
export const useDisableDrag = () => {
  const cb = useCallback((e: any) => {
    e.preventDefault();
    return false;
  }, []);

  return cb;
};
