// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Ref, useEffect, useState } from 'react';
import { first, last, noop } from 'lodash';

function getTop(element: Readonly<Element>): number {
  return element.getBoundingClientRect().top;
}

function isWrapped(element: Readonly<null | HTMLElement>): boolean {
  if (!element) {
    return false;
  }

  const { children } = element;
  const firstChild = first(children);
  const lastChild = last(children);

  return Boolean(
    firstChild &&
      lastChild &&
      firstChild !== lastChild &&
      getTop(firstChild) !== getTop(lastChild)
  );
}

/**
 * A hook that returns a ref (to put on your element) and a boolean. The boolean will be
 * `true` if the element's children have different `top`s, and `false` otherwise.
 */
export function useHasWrapped<T extends HTMLElement>(): [Ref<T>, boolean] {
  const [element, setElement] = useState<null | T>(null);

  const [hasWrapped, setHasWrapped] = useState(isWrapped(element));

  useEffect(() => {
    if (!element) {
      return noop;
    }

    // We can remove this `any` when we upgrade to TypeScript 4.2+, which adds
    //   `ResizeObserver` type definitions.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const observer = new (window as any).ResizeObserver(() => {
      setHasWrapped(isWrapped(element));
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [element]);

  return [setElement, hasWrapped];
}
