// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FC, ReactNode } from 'react';
import { memo } from 'react';
import { Slot } from 'radix-ui';
import { AriaLabelled } from './AriaLabelled.dom.tsx';

/**
 * `Label` and `Description` label the closest `Item`.
 *
 * @example Anatomy
 * ```tsx
 * <AriaList.Root label="List Label">
 *   <AriaList.Item>
 *     <AriaList.Label>Item Label</AriaList.Label>
 *     <AriaList.Description>Item Description</AriaList.Description>
 *   </AriaList.Item>
 *   <AriaList.Item>
 *     <AriaList.Label>Group Label</AriaList.Label>
 *     <AriaList.Description>Group Description</AriaList.Description>
 *     <AriaList.Group>
 *       <AriaList.Item>
 *         <AriaList.Label>Nested Item Label</AriaList.Label>
 *         <AriaList.Description>Nested Item Description</AriaList.Description>
 *       </AriaList.Item>
 *     </AriaList.Group>
 *   </AriaList.Item>
 * </AriaList.Root>
 * ```
 */
export namespace AriaList {
  /**
   * <AriaList.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    asChild?: boolean;
    /** Accessible label for the list. */
    label?: string;
    children: ReactNode;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    const Comp = props.asChild ? Slot.Root : 'div';
    return (
      <Comp role="list" aria-label={props.label}>
        {props.children}
      </Comp>
    );
  });

  Root.displayName = 'AriaList.Root';

  /**
   * <AriaList.Group>
   * --------------------------------------------------------------------------
   */

  export type GroupProps = Readonly<{
    asChild?: boolean;
    children: ReactNode;
  }>;

  export const Group: FC<GroupProps> = memo(props => {
    const Comp = props.asChild ? Slot.Root : 'div';
    return <Comp role="list">{props.children}</Comp>;
  });

  Group.displayName = 'AriaList.Group';

  /**
   * <AriaList.Item>
   * --------------------------------------------------------------------------
   */

  export type ItemProps = Readonly<{
    asChild?: boolean;
    id?: string;
    children: ReactNode;
  }>;

  export const Item: FC<ItemProps> = memo(props => {
    const Comp = props.asChild ? Slot.Root : 'div';
    return (
      <AriaLabelled.Root asChild id={props.id}>
        <Comp role="listitem">{props.children}</Comp>
      </AriaLabelled.Root>
    );
  });

  Item.displayName = 'AriaList.Item';

  /**
   * <AriaList.Label>
   * --------------------------------------------------------------------------
   */

  export type LabelProps = Readonly<{
    asChild?: boolean;
    id?: string;
    children: ReactNode;
  }>;

  export const Label: FC<LabelProps> = memo(props => {
    return <AriaLabelled.Label {...props} />;
  });

  Label.displayName = 'AriaList.Label';

  /**
   * <AriaList.Description>
   * --------------------------------------------------------------------------
   */

  export type DescriptionProps = Readonly<{
    asChild?: boolean;
    id?: string;
    children: ReactNode;
  }>;

  export const Description: FC<DescriptionProps> = memo(props => {
    return <AriaLabelled.Description {...props} />;
  });

  Description.displayName = 'AriaList.Description';
}
