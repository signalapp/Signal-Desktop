// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ButtonHTMLAttributes, FC, ForwardedRef, ReactNode } from 'react';
import React, { forwardRef, memo, useCallback } from 'react';
import { ToggleGroup } from 'radix-ui';
import { ExperimentalAxoBaseSegmentedControl } from './_internal/AxoBaseSegmentedControl.dom.js';

const Namespace = 'AxoSegmentedControl';

/**
 * @example Anatomy
 * ```tsx
 * <AxoSegmentedControl.Root>
 *   <AxoSegmentedControl.Item>
 *     <AxoSegmentedControl.ItemText/>
 *     <AxoSegmentedControl.ItemBadge/>
 *   </AxoSegmentedControl.Item>
 * </AxoSegmentedControl.Root>
 * ```
 */
export namespace ExperimentalAxoSegmentedControl {
  export type Variant = ExperimentalAxoBaseSegmentedControl.Variant;

  /**
   * Component: <AxoSegmentedControl.Root>
   * -------------------------------------
   */

  export type RootWidth = ExperimentalAxoBaseSegmentedControl.RootWidth;
  export type ItemWidth = ExperimentalAxoBaseSegmentedControl.ItemWidth;

  export type RootProps = Readonly<{
    width: RootWidth;
    itemWidth: ItemWidth;
    variant: Variant;
    value: string | null;
    onValueChange: (newValue: string | null) => void;
    children: ReactNode;
  }>;

  export const Root = memo((props: RootProps) => {
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

  Root.displayName = `${Namespace}.Root`;

  /**
   * Component: <AxoSegmentedControl.Item>
   * -------------------------------------
   */

  export type ItemProps = ButtonHTMLAttributes<HTMLButtonElement> &
    Readonly<{
      value: string;
      children: ReactNode;
    }>;

  export const Item: FC<ItemProps> = memo(
    forwardRef((props: ItemProps, ref: ForwardedRef<HTMLButtonElement>) => {
      const { value, children, ...rest } = props;
      return (
        <ToggleGroup.Item {...rest} ref={ref} value={value} asChild>
          <ExperimentalAxoBaseSegmentedControl.Item value={value}>
            {children}
          </ExperimentalAxoBaseSegmentedControl.Item>
        </ToggleGroup.Item>
      );
    })
  );

  Item.displayName = `${Namespace}.Item`;

  /**
   * Component: <AxoSegmentedControl.ItemText>
   * -----------------------------------------
   */

  export type ItemTextProps = Readonly<{
    maxWidth?: ExperimentalAxoBaseSegmentedControl.ItemMaxWidth;
    children: ReactNode;
  }>;

  export const ItemText: FC<ItemTextProps> = memo((props: ItemTextProps) => {
    return (
      <ExperimentalAxoBaseSegmentedControl.ItemText maxWidth={props.maxWidth}>
        {props.children}
      </ExperimentalAxoBaseSegmentedControl.ItemText>
    );
  });

  ItemText.displayName = `${Namespace}.ItemText`;

  /**
   * Component: <AxoSegmentedControl.ItemBadge>
   * ------------------------------------------
   */

  export type ExperimentalItemBadgeProps =
    ExperimentalAxoBaseSegmentedControl.ExperimentalItemBadgeProps;

  export const { ExperimentalItemBadge } = ExperimentalAxoBaseSegmentedControl;
}
