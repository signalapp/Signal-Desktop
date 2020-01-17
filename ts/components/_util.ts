// A separate file so this doesn't get picked up by StyleGuidist over real components

import { Ref } from 'react';
import { isFunction } from 'lodash';

export function cleanId(id: string): string {
  return id.replace(/[^\u0020-\u007e\u00a0-\u00ff]/g, '_');
}

export function mergeRefs<T>(...refs: Array<Ref<T>>) {
  return (t: T) => {
    refs.forEach(r => {
      if (isFunction(r)) {
        r(t);
      } else if (r) {
        // @ts-ignore: React's typings for ref objects is annoying
        r.current = t;
      }
    });
  };
}
