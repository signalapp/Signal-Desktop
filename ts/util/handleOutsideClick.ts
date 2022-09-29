// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { RefObject } from 'react';

export type ClickHandlerType = (target: Node) => boolean;
export type ContainerElementType = Node | RefObject<Node> | null | undefined;

// TODO(indutny): DESKTOP-4177
// A stack of handlers. Handlers are executed from the top to the bottom
const fakeClickHandlers = new Array<(event: MouseEvent) => boolean>();

function runFakeClickHandlers(event: MouseEvent): void {
  for (const handler of fakeClickHandlers.slice().reverse()) {
    if (handler(event)) {
      break;
    }
  }
}

export type HandleOutsideClickOptionsType = Readonly<{
  name: string;
  containerElements: ReadonlyArray<ContainerElementType>;
}>;

export const handleOutsideClick = (
  handler: ClickHandlerType,
  { containerElements }: HandleOutsideClickOptionsType
): (() => void) => {
  const handleEvent = (event: MouseEvent) => {
    const target = event.target as Node;

    const isInside = containerElements.some(elem => {
      if (!elem) {
        return false;
      }
      if (elem instanceof Node) {
        return elem.contains(target);
      }
      return elem.current?.contains(target);
    });

    // Clicked inside of one of container elements - stop processing
    if (isInside) {
      return true;
    }

    // Stop processing if requested by handler function
    return handler(target);
  };

  fakeClickHandlers.push(handleEvent);
  if (fakeClickHandlers.length === 1) {
    const useCapture = true;
    document.addEventListener('click', runFakeClickHandlers, useCapture);
  }

  return () => {
    const index = fakeClickHandlers.indexOf(handleEvent);
    fakeClickHandlers.splice(index, 1);

    if (fakeClickHandlers.length === 0) {
      const useCapture = true;
      document.removeEventListener('click', handleEvent, useCapture);
    }
  };
};
