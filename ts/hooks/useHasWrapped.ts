// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Ref } from 'react';
import { useEffect, useState } from 'react';
import { first, last, noop } from 'lodash';

function getBottom(element: Readonly<Element>): number {
  return element.getBoundingClientRect().bottom;
}

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
      getBottom(firstChild) <= getTop(lastChild)
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

    const observer = new ResizeObserver(() => {
      setHasWrapped(isWrapped(element));
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [element]);

  return [setElement, hasWrapped];
}
