// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC, Ref, ReactNode } from 'react';
import { memo, useCallback } from 'react';
import { ToggleGroup } from 'radix-ui';
import { ExperimentalAxoBaseSegmentedControl } from './_internal/AxoBaseSegmentedControl.dom.tsx';

/**
 * A row of mutually-exclusive buttons, used for tab-style navigation or
 * selecting a single option from a small set.
 *
 * @example Anatomy
 * ```tsx
 * <AxoSegmentedControl.Root>
 *   <AxoSegmentedControl.Item>
 *     <AxoSegmentedControl.ItemText/>
 *     <AxoSegmentedControl.ItemBadge/>
 *   </AxoSegmentedControl.Item>
 * </AxoSegmentedControl.Root>
 * ```
 *
 * @see {@link https://www.radix-ui.com/primitives/docs/components/toggle-group | Toggle Group - Radix Docs}
 * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/button/ | Button Pattern - ARIA Authoring Practices Guide}
 * @see {@link https://w3c.github.io/aria/#button | `button` role - WAI-ARIA 1.3}
 * @see {@link https://w3c.github.io/aria/#aria-pressed | `aria-pressed` state - WAI-ARIA 1.3}
 */
export namespace ExperimentalAxoSegmentedControl {
  /**
   * <AxoSegmentedControl.Root>
   * --------------------------------------------------------------------------
   */

  /**
   * Visual style of the control.
   */
  export type Variant = ExperimentalAxoBaseSegmentedControl.Variant;

  /**
   * Width of the entire control:
   * - `fit`: Shrinks to fit the combined width of all items.
   * - `full`: Stretches to fill the container.
   */
  export type RootWidth = ExperimentalAxoBaseSegmentedControl.RootWidth;

  /**
   * How each item is sized within the control:
   * - `fit`: Each item shrinks to fit its content.
   * - `equal`: All items share equal width.
   */
  export type ItemWidth = ExperimentalAxoBaseSegmentedControl.ItemWidth;

  export type RootProps = Readonly<{
    /**
     * Width of the entire control.
     */
    width: RootWidth;
    /**
     * How each item is sized within the control.
     */
    itemWidth: ItemWidth;
    /**
     * Visual style of the control.
     */
    variant: Variant;
    /**
     * The controlled value of the pressed item.
     * Must be used in conjunction with `onValueChange`.
     */
    value: string | null;
    /**
     * Event handler called when the pressed state of an item changes.
     */
    onValueChange: (newValue: string | null) => void;
    /**
     * Should be `Item` elements.
     */
    children: ReactNode;
  }>;

  /**
   * Container for the segmented control.
   *
   * @example Tab-style navigation
   * ```tsx
   * <AxoSegmentedControl.Root
   *   variant="no-track"
   *   width="full"
   *   itemWidth="equal"
   *   value={tab}
   *   onValueChange={setTab}
   * >
   *   <AxoSegmentedControl.Item value="media">
   *     <AxoSegmentedControl.ItemText>Media</AxoSegmentedControl.ItemText>
   *   </AxoSegmentedControl.Item>
   *   <AxoSegmentedControl.Item value="audio">
   *     <AxoSegmentedControl.ItemText>Audio</AxoSegmentedControl.ItemText>
   *   </AxoSegmentedControl.Item>
   * </AxoSegmentedControl.Root>
   * ```
   */
  export const Root: FC<RootProps> = memo(props => {
    const { onValueChange } = props;

    const handleValueChange = useCallback(
      (newValue: string) => {
        onValueChange(newValue === '' ? null : newValue);
      },
      [onValueChange]
    );

    return (
      <ToggleGroup.Root
        type="single"
        value={props.value ?? undefined}
        onValueChange={handleValueChange}
        orientation="horizontal"
        loop
        rovingFocus
        asChild
      >
        <ExperimentalAxoBaseSegmentedControl.Root
          value={props.value}
          variant={props.variant}
          width={props.width}
          itemWidth={props.itemWidth}
        >
          {props.children}
        </ExperimentalAxoBaseSegmentedControl.Root>
      </ToggleGroup.Root>
    );
  });

  Root.displayName = 'AxoSegmentedControl.Root';

  /**
   * <AxoSegmentedControl.Item>
   * --------------------------------------------------------------------------
   */

  export type ItemProps = Readonly<{
    /**
     * Ref to the underlying `<button>` element.
     */
    ref?: Ref<HTMLButtonElement>;
    /**
     * A unique value for the item.
     */
    value: string;
    /**
     * Should be an `ItemText`, optionally followed by an `ExperimentalItemBadge`.
     */
    children: ReactNode;
  }>;

  /**
   * An item in the group.
   */
  export const Item: FC<ItemProps> = memo(props => {
    const { value, children, ...rest } = props;
    return (
      <ToggleGroup.Item asChild ref={props.ref} value={value} {...rest}>
        <ExperimentalAxoBaseSegmentedControl.Item value={value}>
          {children}
        </ExperimentalAxoBaseSegmentedControl.Item>
      </ToggleGroup.Item>
    );
  });

  Item.displayName = 'AxoSegmentedControl.Item';

  /**
   * <AxoSegmentedControl.ItemText>
   * --------------------------------------------------------------------------
   */

  export type ItemTextProps = Readonly<{
    /**
     * CSS `max-width` to apply to the text, e.g. `"12ch"` to prevent long
     * labels from stretching the control.
     */
    maxWidth?: ExperimentalAxoBaseSegmentedControl.ItemMaxWidth;
    /**
     * The visible label for this item.
     */
    children: ReactNode;
  }>;

  /**
   * The text label inside an `Item`.
   */
  export const ItemText: FC<ItemTextProps> = memo(props => {
    return (
      <ExperimentalAxoBaseSegmentedControl.ItemText maxWidth={props.maxWidth}>
        {props.children}
      </ExperimentalAxoBaseSegmentedControl.ItemText>
    );
  });

  ItemText.displayName = 'AxoSegmentedControl.ItemText';

  /**
   * <AxoSegmentedControl.ItemBadge>
   * --------------------------------------------------------------------------
   */

  export type ExperimentalItemBadgeProps =
    ExperimentalAxoBaseSegmentedControl.ExperimentalItemBadgeProps;

  /**
   * A badge shown on an item, typically for unread counts.
   */
  export const ExperimentalItemBadge: FC<ExperimentalItemBadgeProps> = memo(
    props => {
      return (
        <ExperimentalAxoBaseSegmentedControl.ExperimentalItemBadge {...props} />
      );
    }
  );

  ExperimentalItemBadge.displayName = 'AxoSegmentedControl.ItemBadge';
}
