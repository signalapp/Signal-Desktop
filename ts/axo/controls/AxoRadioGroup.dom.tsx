// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { RadioGroup } from 'radix-ui';
import type { FC, ReactNode } from 'react';
import { memo } from 'react';
import { tw } from '../tw.dom.tsx';
import { AxoBaseRadioGroup } from './_AxoBaseRadioGroup.dom.tsx';

/**
 * A set of checkable buttons—known as radio buttons—where no more than one of
 * the buttons can be checked at a time.
 *
 * @example Anatomy
 * ```tsx
 * <AxoRadioGroup.Root value={value} onValueChange={setValue}>
 *   <AxoRadioGroup.Item value="option-a">
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
   *     <AxoRadioGroup.Label>All messages</AxoRadioGroup.Label>
   *   </AxoRadioGroup.Item>
   *   <AxoRadioGroup.Item value="mentions">
   *     <AxoRadioGroup.Label>Mentions only</AxoRadioGroup.Label>
   *   </AxoRadioGroup.Item>
   *   <AxoRadioGroup.Item value="off">
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
     * Should contain an accessible label
     */
    children: ReactNode;
  }>;

  /**
   * A single radio option.
   */
  export const Item: FC<ItemProps> = memo(props => {
    return (
      <AxoBaseRadioGroup.Item
        asChild
        value={props.value}
        disabled={props.disabled}
      >
        <div className={tw('flex gap-3 py-2.5')}>
          <AxoBaseRadioGroup.Indicator />
          {props.children}
        </div>
      </AxoBaseRadioGroup.Item>
    );
  });

  Item.displayName = 'AxoRadioGroup.Item';

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
      <AxoBaseRadioGroup.Label asChild>
        <span className={tw('truncate type-body-large text-primary')}>
          {props.children}
        </span>
      </AxoBaseRadioGroup.Label>
    );
  });

  Label.displayName = 'AxoRadioGroup.Label';
}
