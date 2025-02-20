// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { focusSafely, getFocusableTreeWalker } from '@react-aria/focus';
import type { ReactNode, RefObject } from 'react';
import React, { useEffect, useRef } from 'react';
import { createKeybindingsHandler } from 'tinykeys';
import { strictAssert } from '../../../util/assert';

export abstract class KeyboardDelegate<State> {
  abstract scrollToState(state: State): void;
  abstract getInitialState(): State;
  abstract getKeyFromState(state: State): string | null;
  abstract onFocusChange(state: State, key: string | null): State;
  abstract onFocusLeave(state: State): State;
  abstract onArrowLeft(state: State): State;
  abstract onArrowRight(state: State): State;
  abstract onArrowUp(state: State): State;
  abstract onArrowDown(state: State): State;
  abstract onPageUp(state: State): State;
  abstract onPageDown(state: State): State;
  abstract onHome(state: State): State;
  abstract onEnd(state: State): State;
  abstract onModHome(state: State): State;
  abstract onModEnd(state: State): State;
}

export type FunKeyboardNavigationOptions<State> = Readonly<{
  scrollerRef: RefObject<HTMLElement>;
  keyboard: KeyboardDelegate<State>;
}>;

export type FunKeyboardProps<State> = Readonly<{
  scrollerRef: React.RefObject<HTMLElement>;
  keyboard: KeyboardDelegate<State>;
  onStateChange: (state: State) => void;
  children: ReactNode;
}>;

export function FunKeyboard<State>(
  props: FunKeyboardProps<State>
): JSX.Element {
  const keyboardRef = useRef(props.keyboard);
  useEffect(() => {
    keyboardRef.current = props.keyboard;
  }, [props.keyboard]);

  const onStateChangeRef = useRef(props.onStateChange);
  useEffect(() => {
    onStateChangeRef.current = props.onStateChange;
  }, [props.onStateChange]);

  useEffect(() => {
    strictAssert(props.scrollerRef.current, 'scrollerRef.current not defined');
    const scroller = props.scrollerRef.current;

    function getKeyboard() {
      return keyboardRef.current;
    }

    function getKeyFromElement(element: HTMLElement): string | null {
      const item = element.closest('[data-key]');
      if (item == null || !scroller.contains(item)) {
        return null;
      }
      strictAssert(item instanceof HTMLElement, 'Item must be HTMLElement');
      const { key } = item.dataset;
      strictAssert(key != null, 'Missing [data-key] attribute');
      return key;
    }

    function getElementFromKey(key: string): HTMLElement {
      const element = scroller.querySelector(`[data-key="${key}"]`);
      strictAssert(element != null, `Missing element for key ${key}`);
      strictAssert(element instanceof HTMLElement, 'Element must be found');
      return element;
    }

    // State

    let currentState: State = getKeyboard().getInitialState();

    function updateState(nextState: State) {
      currentState = nextState;
      onStateChangeRef.current(currentState);
    }

    // Focus Events

    function onFocusIn(event: FocusEvent) {
      strictAssert(
        event.target instanceof HTMLElement,
        'Must have target element'
      );
      const keyboard = getKeyboard();
      const targetKey = getKeyFromElement(event.target);
      const stateKey = keyboard.getKeyFromState(currentState);
      if (targetKey !== stateKey) {
        updateState(keyboard.onFocusChange(currentState, targetKey));
      }
    }

    function onFocusOut(event: FocusEvent) {
      const keyboard = getKeyboard();
      // We only care if the focus has left the scroller
      if (!scroller.contains(event.relatedTarget as Node)) {
        updateState(keyboard.onFocusLeave(currentState));
      }
    }

    // Keyboard Events

    function wrap(handler: () => State) {
      return (event: KeyboardEvent) => {
        event.preventDefault();
        event.stopPropagation();

        const keyboard = getKeyboard();

        const prevState = currentState;
        const prevKey = keyboard.getKeyFromState(prevState);
        const nextState = handler();
        const nextKey = keyboard.getKeyFromState(nextState);

        updateState(nextState);

        // Scroll and move focus to new index if it changed
        if (nextKey != null && nextKey !== prevKey) {
          keyboard.scrollToState(nextState);

          const element = getElementFromKey(nextKey);
          const tabbable = getFocusableTreeWalker(element, {
            tabbable: false, // TODO: Should this be false?
          });
          const firstTabbable = tabbable.firstChild();
          if (firstTabbable instanceof HTMLElement) {
            focusSafely(firstTabbable);
          }
        }
      };
    }

    const onKeyDown = createKeybindingsHandler({
      ArrowLeft: wrap(() => getKeyboard().onArrowLeft(currentState)),
      ArrowRight: wrap(() => getKeyboard().onArrowRight(currentState)),
      ArrowUp: wrap(() => getKeyboard().onArrowUp(currentState)),
      ArrowDown: wrap(() => getKeyboard().onArrowDown(currentState)),
      PageUp: wrap(() => getKeyboard().onPageUp(currentState)),
      PageDown: wrap(() => getKeyboard().onPageDown(currentState)),
      Home: wrap(() => getKeyboard().onHome(currentState)),
      End: wrap(() => getKeyboard().onEnd(currentState)),
      '$mod+Home': wrap(() => getKeyboard().onModHome(currentState)),
      '$mod+End': wrap(() => getKeyboard().onModEnd(currentState)),
    });

    scroller.addEventListener('focusin', onFocusIn);
    scroller.addEventListener('focusout', onFocusOut);
    scroller.addEventListener('keydown', onKeyDown);

    return () => {
      scroller.removeEventListener('focusin', onFocusIn);
      scroller.removeEventListener('focusout', onFocusOut);
      scroller.removeEventListener('keydown', onKeyDown);
    };
  }, [props.scrollerRef]);

  return <>{props.children}</>;
}
