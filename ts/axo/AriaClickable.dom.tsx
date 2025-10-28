// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, {
  createContext,
  memo,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import type { ReactNode, MouseEvent, FC } from 'react';
import { useLayoutEffect } from '@react-aria/utils';
import { tw } from './tw.dom.js';
import { assert } from './_internal/assert.dom.js';

const Namespace = 'AriaClickable';

/**
 * @example Anatomy
 * ```tsx
 * export default () => (
 *   <AriaClickable.Root>
 *     <h3>Card Title</h3>
 *     <p>
 *       Lorem ipsum dolor sit amet consectetur adipisicing elit...
 *       <span id="see-more-1">See more</span>
 *       <AriaClickable.HiddenTrigger aria-labelledby="see-more-1"/>
 *     </p>
 *     <AriaClickable.SubWidget>
 *       <AxoButton.Root>Delete</AxoButton.Root>
 *     </AriaClickable.SubWidget>
 *     <AriaClickable.SubWidget>
 *       <AxoLink>Edit</AxoLink>
 *     </AriaClickable.SubWidget>
 *   </AriaClickable.Root>
 * );
 * ```
 */
export namespace AriaClickable {
  type TriggerState = Readonly<{
    hovered: boolean;
    pressed: boolean;
    focused: boolean;
  }>;

  const INITIAL_TRIGGER_STATE: TriggerState = {
    hovered: false,
    pressed: false,
    focused: false,
  };

  type TriggerStateUpdate = (state: TriggerState) => void;

  const TriggerStateUpdateContext = createContext<TriggerStateUpdate | null>(
    null
  );

  /**
   * Component: <AriaClickable.Root>
   * -------------------------------
   */

  export type RootProps = Readonly<{
    className?: string;
    children: ReactNode;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    const [hovered, setHovered] = useState(INITIAL_TRIGGER_STATE.hovered);
    const [pressed, setPressed] = useState(INITIAL_TRIGGER_STATE.pressed);
    const [focused, setFocused] = useState(INITIAL_TRIGGER_STATE.focused);

    const handleTriggerStateUpdate: TriggerStateUpdate = useCallback(state => {
      setHovered(state.hovered);
      setPressed(state.pressed);
      setFocused(state.focused);
    }, []);

    return (
      <TriggerStateUpdateContext.Provider value={handleTriggerStateUpdate}>
        <div
          // eslint-disable-next-line better-tailwindcss/no-restricted-classes
          className={tw('relative!', props.className)}
          // For styling based on the HiddenTrigger state.
          data-hovered={hovered ? true : null}
          data-focused={focused ? true : null}
          data-pressed={pressed ? true : null}
        >
          {props.children}
        </div>
      </TriggerStateUpdateContext.Provider>
    );
  });

  Root.displayName = `${Namespace}.Root`;

  /**
   * Component: <AriaClickable.SubAction>
   * ------------------------------------
   */

  export type SubWidgetProps = Readonly<{
    children: ReactNode;
  }>;

  /**
   * Every nested interactive widget (buttons, links, selects, etc) should be
   * wrapped with <SubWidget> in order to give it the correct styles (z-index).
   */
  export const SubWidget: FC<SubWidgetProps> = memo(props => {
    return (
      <div
        // eslint-disable-next-line better-tailwindcss/no-restricted-classes
        className={tw('contents *:relative *:z-20')}
      >
        {props.children}
      </div>
    );
  });

  SubWidget.displayName = `${Namespace}.SubWidget`;

  export type DeadAreaProps = Readonly<{
    className?: string;
    children: ReactNode;
  }>;

  /**
   * Use this to create an "dead" area around your nested widgets where the
   * pointer won't click the `<HiddenTrigger>`.
   *
   * This is useful when you want to prevent accidental clicks around one or
   * more nested widgets.
   */
  export const DeadArea: FC<DeadAreaProps> = memo(props => {
    return (
      // eslint-disable-next-line better-tailwindcss/no-restricted-classes
      <div className={tw('relative! z-20!', props.className)}>
        {props.children}
      </div>
    );
  });

  DeadArea.displayName = `${Namespace}.DeadArea`;

  /**
   * Component: <AriaClickable.HiddenTrigger>
   * ------------------------------------
   */

  export type HiddenTriggerProps = Readonly<{
    /**
     * This should reference the ID of an element that describes the action that
     * will be taken `onClick`, not the entire clickable root.
     *
     * @example
     * ```tsx
     * <span id="see-more-1">See more</span>
     * <HiddenTrigger aria-labelledby="see-more-1"/>
     * ```
     */
    'aria-labelledby': string;
    onClick: (event: MouseEvent) => void;
  }>;

  /**
   * Provides an invisible button that fills the entire area of
   * `<AriaClickable.Root>`
   *
   * Notes:
   * - This cannot be wrapped with any other `position: relative` element.
   * - This should be inserted in the expected focus order, which is likely
   *   before any <AriaClickable.SubWidget>.
   */
  export const HiddenTrigger: FC<HiddenTriggerProps> = memo(props => {
    const ref = useRef<HTMLButtonElement>(null);
    const onTriggerStateUpdate = useContext(TriggerStateUpdateContext);

    if (onTriggerStateUpdate == null) {
      throw new Error(
        `<${Namespace}.HiddenTrigger> must be wrapped with <${Namespace}.Root>`
      );
    }

    const onTriggerStateUpdateRef = useRef(onTriggerStateUpdate);
    useLayoutEffect(() => {
      onTriggerStateUpdateRef.current = onTriggerStateUpdate;
    }, [onTriggerStateUpdate]);

    useLayoutEffect(() => {
      const button = assert(ref.current, 'Missing ref');
      let timer: ReturnType<typeof setTimeout>;

      function update() {
        onTriggerStateUpdateRef.current({
          hovered: button.matches(':hover:not(:disabled)'),
          pressed: button.matches(':active:not(:disabled)'),
          focused: button.matches('.keyboard-mode :focus'),
        });
      }

      function delayedUpdate() {
        clearTimeout(timer);
        timer = setTimeout(update, 1);
      }

      update();
      button.addEventListener('pointerenter', update);
      button.addEventListener('pointerleave', update);
      button.addEventListener('pointerdown', update);
      button.addEventListener('pointerup', update);
      button.addEventListener('focus', update);
      button.addEventListener('blur', update);
      // need delay
      button.addEventListener('keydown', delayedUpdate);
      button.addEventListener('keyup', delayedUpdate);

      return () => {
        clearTimeout(timer);
        onTriggerStateUpdateRef.current(INITIAL_TRIGGER_STATE);
        button.removeEventListener('pointerenter', update);
        button.removeEventListener('pointerleave', update);
        button.removeEventListener('pointerdown', update);
        button.removeEventListener('pointerup', update);
        button.removeEventListener('focus', update);
        button.removeEventListener('blur', update);
        // need delay
        button.removeEventListener('keydown', delayedUpdate);
        button.removeEventListener('keyup', delayedUpdate);
      };
    }, []);

    return (
      <button
        ref={ref}
        type="button"
        className={tw('absolute inset-0 z-10 outline-0')}
        aria-labelledby={props['aria-labelledby']}
        onClick={props.onClick}
      />
    );
  });

  HiddenTrigger.displayName = `${Namespace}.HiddenTrigger`;
}
