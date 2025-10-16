// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { RefObject } from 'react';
import { createLogger } from '../logging/log.std.js';

const log = createLogger('handleOutsideClick');

export type HandlerType = (target: Node, event: MouseEvent) => boolean;
export type HandlersType = {
  name: string;
  handleClick: HandlerType;
  handlePointerDown: HandlerType;
};
export type ContainerElementType = Node | RefObject<Node> | null | undefined;

// TODO(indutny): DESKTOP-4177
// A stack of handlers. Handlers are executed from the top to the bottom
const fakeHandlers = new Array<HandlersType>();

export type HandleOutsideClickOptionsType = Readonly<{
  name: string;
  containerElements: ReadonlyArray<ContainerElementType>;
}>;

function handleGlobalPointerDown(event: MouseEvent) {
  for (const handlers of fakeHandlers) {
    // continue even if handled, so that we can detect if the click was inside
    handlers.handlePointerDown(event.target as Node, event);
  }
}

function handleGlobalClick(event: MouseEvent) {
  for (const handlers of fakeHandlers.slice().reverse()) {
    const handled = handlers.handleClick(event.target as Node, event);
    if (handled) {
      log.info(`${handlers.name} handled click`);
      break;
    }
  }
}

const eventOptions = { capture: true };

export const handleOutsideClick = (
  handler: HandlerType,
  { name, containerElements }: HandleOutsideClickOptionsType
): (() => void) => {
  function isInside(target: Node) {
    return containerElements.some(elem => {
      if (!elem) {
        return false;
      }
      if (elem instanceof Node) {
        return elem.contains(target);
      }
      return elem.current?.contains(target);
    });
  }

  let startedInside = false;

  function handlePointerDown(target: Node) {
    startedInside = isInside(target);
    return false;
  }

  function handleClick(target: Node, event: MouseEvent) {
    const endedInside = isInside(target);
    // Clicked inside of one of container elements - stop processing
    if (startedInside || endedInside) {
      return true;
    }
    // Stop processing if requested by handler function
    return handler(target, event);
  }

  const fakeHandler = {
    name,
    handleClick,
    handlePointerDown,
  };

  fakeHandlers.push(fakeHandler);

  if (fakeHandlers.length === 1) {
    document.addEventListener(
      'pointerdown',
      handleGlobalPointerDown,
      eventOptions
    );
    document.addEventListener('click', handleGlobalClick, eventOptions);
  }

  return () => {
    const index = fakeHandlers.indexOf(fakeHandler);
    fakeHandlers.splice(index, 1);

    if (fakeHandlers.length === 0) {
      document.removeEventListener(
        'pointerdown',
        handleGlobalPointerDown,
        eventOptions
      );
      document.removeEventListener('click', handleGlobalClick, eventOptions);
    }
  };
};
