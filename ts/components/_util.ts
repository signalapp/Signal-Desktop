import { MutableRefObject, Ref } from 'react';
import { isFunction } from 'lodash';
import memoizee from 'memoizee';

export function cleanId(id: string): string {
  return id.replace(/[^\u0020-\u007e\u00a0-\u00ff]/g, '_');
}

// Memoizee makes this difficult.
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const createRefMerger = () =>
  memoizee(
    <T>(...refs: Array<Ref<T>>) => {
      return (t: T) => {
        refs.forEach(r => {
          if (isFunction(r)) {
            r(t);
          } else if (r) {
            // Using a MutableRefObject as intended
            // eslint-disable-next-line no-param-reassign
            (r as MutableRefObject<T>).current = t;
          }
        });
      };
    },
    { length: false, max: 1 }
  );
