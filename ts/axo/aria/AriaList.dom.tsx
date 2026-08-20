// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FC, ReactNode } from 'react';
import { memo } from 'react';
import { Slot } from 'radix-ui';
import { AriaLabelled } from './AriaLabelled.dom.tsx';

export namespace AriaList {
  /**
   * <AriaList.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    asChild?: boolean;
    children: ReactNode;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    const Comp = props.asChild ? Slot.Root : 'ul';
    return <Comp role="list">{props.children}</Comp>;
  });

  Root.displayName = 'AriaList.Root';

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
    const Comp = props.asChild ? Slot.Root : 'li';
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
