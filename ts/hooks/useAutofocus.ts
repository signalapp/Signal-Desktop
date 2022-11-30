import type { RefObject } from 'react';
import { useEffect } from 'react';

export const useAutofocus = <T extends HTMLElement>(
  ref: RefObject<T | null>
): void => {
  useEffect(() => {
    ref.current?.focus();
  }, [ref]);
};
