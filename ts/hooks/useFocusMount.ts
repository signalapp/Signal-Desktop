import React from 'react';
// tslint:disable-next-line: no-submodule-imports
import useMount from 'react-use/lib/useMount';

export function useFocusMount(ref: React.RefObject<any>, isEditable?: boolean) {
  useMount(() => {
    if (isEditable) {
      ref?.current?.focus();
    }
  });
}
