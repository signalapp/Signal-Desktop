// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Ref } from 'react';

export function multiRef<T>(...refs: Array<Ref<T>>): (topLevelRef: T) => void {
  return (el: T) => {
    refs.forEach(ref => {
      // This is a simplified version of [what React does][0] to set a ref.
      // [0]: https://github.com/facebook/react/blob/29b7b775f2ecf878eaf605be959d959030598b07/packages/react-reconciler/src/ReactFiberCommitWork.js#L661-L677
      if (typeof ref === 'function') {
        ref(el);
      } else if (ref) {
        // I believe the types for `ref` are wrong in this case, as `ref.current` should
        //   not be `readonly`. That's why we do this cast. See [the React source][1].
        // [1]: https://github.com/facebook/react/blob/29b7b775f2ecf878eaf605be959d959030598b07/packages/shared/ReactTypes.js#L78-L80
        // eslint-disable-next-line no-param-reassign
        (ref as React.MutableRefObject<T>).current = el;
      }
    });
  };
}
