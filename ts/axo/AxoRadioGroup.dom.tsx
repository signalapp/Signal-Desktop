// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { RadioGroup } from 'radix-ui';
import type { FC, ReactNode } from 'react';
import { memo, useId, useMemo } from 'react';
import { tw } from './tw.dom.tsx';
import {
  createStrictContext,
  useStrictContext,
} from './_internal/StrictContext.dom.tsx';

/**
 * A set of checkable buttons—known as radio buttons—where no more than one of
 * the buttons can be checked at a time.
 *
 * @example Anatomy
 * ```tsx
 * <AxoRadioGroup.Root value={value} onValueChange={setValue}>
 *   <AxoRadioGroup.Item value="option-a">
 *     <AxoRadioGroup.Indicator />
 *     <AxoRadioGroup.Label>Option A</AxoRadioGroup.Label>
 *   </AxoRadioGroup.Item>
 * </AxoRadioGroup.Root>
 * ```
 *
 * @see {@link https://www.radix-ui.com/primitives/docs/components/radio-group | Radio Group - Radix Docs}
 * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/radio/ | Radio Pattern - ARIA Authoring Practices Guide}
 * @see {@link https://w3c.github.io/aria/#radiogroup | `radiogroup` role - WAI-ARIA 1.3}
 * @see {@link https://w3c.github.io/aria/#radio | `radio` role - WAI-ARIA 1.3}
 */
export namespace AxoRadioGroup {
  /**
   * <AxoRadioGroup.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    /**
     * The controlled value of the radio item to check.
     * Should be used in conjunction with `onValueChange`.
     */
    value: string | null;
    /**
     * Event handler called when the value changes.
     */
    onValueChange: (value: string) => void;
    /**
     * When `true`, prevents the user from interacting with radio items.
     */
    disabled?: boolean;
    /**
     * Should be `Item` elements.
     */
    children: ReactNode;
  }>;

  /**
   * Contains all the parts of a radio group.
   *
   * @example Notification preference
   * ```tsx
   * <AxoRadioGroup.Root value={notify} onValueChange={setNotify}>
   *   <AxoRadioGroup.Item value="all">
   *     <AxoRadioGroup.Indicator />
   *     <AxoRadioGroup.Label>All messages</AxoRadioGroup.Label>
   *   </AxoRadioGroup.Item>
   *   <AxoRadioGroup.Item value="mentions">
   *     <AxoRadioGroup.Indicator />
   *     <AxoRadioGroup.Label>Mentions only</AxoRadioGroup.Label>
   *   </AxoRadioGroup.Item>
   *   <AxoRadioGroup.Item value="off">
   *     <AxoRadioGroup.Indicator />
   *     <AxoRadioGroup.Label>Off</AxoRadioGroup.Label>
   *   </AxoRadioGroup.Item>
   * </AxoRadioGroup.Root>
   * ```
   */
  export const Root: FC<RootProps> = memo(props => {
    return (
      <RadioGroup.Root
        value={props.value}
        onValueChange={props.onValueChange}
        disabled={props.disabled}
        className={tw('flex flex-col')}
      >
        {props.children}
      </RadioGroup.Root>
    );
  });

  Root.displayName = 'AxoRadioGroup.Root';

  /**
   * <AxoRadioGroup.Item>
   * --------------------------------------------------------------------------
   */

  /** @internal */
  type ItemContextType = Readonly<{
    id: string;
    value: string;
    disabled: boolean;
  }>;

  /** @internal */
  const ItemContext =
    createStrictContext<ItemContextType>('AxoRadioGroup.Item');

  export type ItemProps = Readonly<{
    /**
     * The value given as data when submitted with a name.
     */
    value: string;
    /**
     * When true, prevents the user from interacting with the radio item.
     */
    disabled?: boolean;
    /**
     * Should be an `Indicator` and a `Label`.
     */
    children: ReactNode;
  }>;

  /**
   * A single radio option.
   */
  export const Item: FC<ItemProps> = memo(props => {
    const { value, disabled = false } = props;
    const id = useId();

    const context = useMemo((): ItemContextType => {
      return { id, value, disabled };
    }, [id, value, disabled]);

    return (
      <ItemContext.Provider value={context}>
        <label htmlFor={id} className={tw('flex gap-3 py-2.5')}>
          {props.children}
        </label>
      </ItemContext.Provider>
    );
  });

  Item.displayName = 'AxoRadioGroup.Item';

  /**
   * <AxoRadioGroup.Indicator>
   * --------------------------------------------------------------------------
   */

  /**
   * Renders when the radio item is in a checked state.
   */
  export const Indicator: FC = memo(() => {
    const context = useStrictContext(ItemContext);
    return (
      <RadioGroup.Item
        id={context.id}
        value={context.value}
        disabled={context.disabled}
        className={tw(
          'flex size-5 shrink-0 items-center justify-center rounded-full',
          'border border-border-primary inset-shadow-on-color',
          'data-[state=unchecked]:bg-fill-primary',
          'data-[state=unchecked]:enabled:active:bg-fill-primary-pressed',
          'data-[state=checked]:bg-color-fill-primary',
          'data-[state=checked]:active:bg-color-fill-primary-pressed',
          'data-disabled:border-border-secondary',
          'outline-none keyboard-mode:focus:outline-focus-ring',
          'overflow-hidden',
          'forced-colors:data-[state=checked]:bg-[SelectedItem]'
        )}
      >
        <RadioGroup.Indicator asChild>
          <span
            className={tw(
              'size-2.25 rounded-full',
              'data-[state=checked]:bg-label-primary-on-color',
              'data-[state=checked]:data-disabled:bg-label-disabled-on-color',
              'forced-colors:data-[state=checked]:bg-[SelectedItemText]'
            )}
          />
        </RadioGroup.Indicator>
      </RadioGroup.Item>
    );
  });

  Indicator.displayName = 'AxoRadioGroup.Indicator';

  /**
   * <AxoRadioGroup.Label>
   * --------------------------------------------------------------------------
   */

  export type LabelProps = Readonly<{
    /**
     * The visible text for this option.
     */
    children: ReactNode;
  }>;

  /**
   * Text label for a radio item.
   */
  export const Label: FC<LabelProps> = memo(props => {
    return (
      <span className={tw('truncate type-body-large text-label-primary')}>
        {props.children}
      </span>
    );
  });

  Label.displayName = 'AxoRadioGroup.Label';
}
