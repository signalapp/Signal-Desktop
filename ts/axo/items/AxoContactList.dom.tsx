// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC, ReactNode, MouseEvent, Ref } from 'react';
import { memo, useId } from 'react';
import { AxoBaseItem } from './_AxoBaseItem.dom.tsx';
import type { AxoSymbol } from '../AxoSymbol.dom.tsx';
import { AxoList } from './AxoList.dom.tsx';
import type { AxoIconButton } from '../AxoIconButton.dom.tsx';
import { forwardExtraPropsForRadix } from '../_internal/props.dom.tsx';
import { tw } from '../tw.dom.tsx';

export namespace AxoContactList {
  /**
   * <AxoContactList.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    title?: ReactNode;
    children: ReactNode;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    return (
      <AxoList.Root>
        <AxoList.Header>
          <AxoList.Title>{props.title}</AxoList.Title>
        </AxoList.Header>
        <AxoList.Body>
          <AxoBaseItem.Group spacing="sm">{props.children}</AxoBaseItem.Group>
        </AxoList.Body>
      </AxoList.Root>
    );
  });

  Root.displayName = 'AxoContactList.Root';

  /**
   * <AxoContactList.Item>
   * --------------------------------------------------------------------------
   */
  export type ItemProps = Readonly<{
    avatar: ReactNode;
    title: ReactNode;
    description?: ReactNode;
    value?: ReactNode;
    accessory?: ReactNode;
    onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  }>;

  export const Item: FC<ItemProps> = memo(props => {
    const id = useId();
    return (
      <AxoBaseItem.Root>
        <AxoBaseItem.LegacyAvatarSlot>
          {props.avatar}
        </AxoBaseItem.LegacyAvatarSlot>
        <AxoBaseItem.Content>
          <AxoBaseItem.Body>
            <AxoBaseItem.Title id={id}>{props.title}</AxoBaseItem.Title>
            {props.value != null && (
              <AxoBaseItem.Value>{props.value}</AxoBaseItem.Value>
            )}
            {props.description != null && (
              <AxoBaseItem.Description truncate>
                {props.description}
              </AxoBaseItem.Description>
            )}
            {props.onClick != null && (
              <AxoBaseItem.HiddenTrigger
                labelledby={id}
                onClick={props.onClick}
              />
            )}
          </AxoBaseItem.Body>
          {props.accessory != null && (
            <AxoBaseItem.Accessory>{props.accessory}</AxoBaseItem.Accessory>
          )}
        </AxoBaseItem.Content>
      </AxoBaseItem.Root>
    );
  });

  Item.displayName = 'AxoContactList.Item';

  /**
   * <AxoContactList.ItemAction>
   * --------------------------------------------------------------------------
   */

  export type ItemActionVariant = 'subtle-secondary';

  export type ItemActionProps = Readonly<{
    ref?: Ref<HTMLButtonElement | null>;
    variant: ItemActionVariant;
    onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
    children: ReactNode;
  }>;

  export const ItemAction: FC<ItemActionProps> = memo(props => {
    const { ref, variant, onClick, children, ...rest } = props;
    return (
      <AxoBaseItem.Action
        ref={ref}
        variant={variant}
        onClick={onClick}
        {...forwardExtraPropsForRadix(rest)}
      >
        {children}
      </AxoBaseItem.Action>
    );
  });

  ItemAction.displayName = 'AxoContactList.ItemAction';

  /**
   * <AxoContactList.ItemIconAction>
   * --------------------------------------------------------------------------
   */

  export type ItemIconActionVariant = 'implied-secondary';

  export type ItemIconActionProps = Readonly<{
    ref?: Ref<HTMLButtonElement | null>;
    variant: ItemIconActionVariant;
    label: string;
    symbol: AxoSymbol.IconName;
    tooltip?: AxoIconButton.RootProps['tooltip'];
    onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  }>;

  export const ItemIconAction: FC<ItemIconActionProps> = memo(props => {
    const { ref, variant, label, symbol, onClick, tooltip, ...rest } = props;
    return (
      <AxoBaseItem.IconAction
        ref={ref}
        variant={variant}
        label={label}
        symbol={symbol}
        onClick={onClick}
        tooltip={tooltip}
        {...forwardExtraPropsForRadix(rest)}
      />
    );
  });

  ItemIconAction.displayName = 'AxoItem.ItemIconAction';

  /**
   * <AxoContactList.ActionItem>
   * --------------------------------------------------------------------------
   */

  export type ActionItemProps = Readonly<{
    symbol: AxoSymbol.IconName;
    title: ReactNode;
    onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  }>;

  export const ActionItem: FC<ActionItemProps> = memo(props => {
    const id = useId();
    return (
      <AxoBaseItem.Root>
        <AxoBaseItem.IconAvatar size={32} symbol={props.symbol} />
        <AxoBaseItem.Content>
          <AxoBaseItem.Body>
            <AxoBaseItem.Title id={id}>{props.title}</AxoBaseItem.Title>
            {props.onClick != null && (
              <AxoBaseItem.HiddenTrigger
                labelledby={id}
                onClick={props.onClick}
              />
            )}
          </AxoBaseItem.Body>
        </AxoBaseItem.Content>
      </AxoBaseItem.Root>
    );
  });

  ActionItem.displayName = 'AxoContactList.ActionItem';

  /**
   * <AxoContactList.EmptyStateItem>
   * --------------------------------------------------------------------------
   */

  export type EmptyStateItemProps = Readonly<{
    title: ReactNode;
  }>;

  export const EmptyStateItem: FC<EmptyStateItemProps> = memo(props => {
    return (
      <AxoBaseItem.Root>
        <AxoBaseItem.Content>
          <AxoBaseItem.Body>
            <AxoBaseItem.Title truncate>
              <span className={tw('text-secondary')}>{props.title}</span>
            </AxoBaseItem.Title>
          </AxoBaseItem.Body>
        </AxoBaseItem.Content>
      </AxoBaseItem.Root>
    );
  });

  EmptyStateItem.displayName = 'AxoContactList.EmptyStateItem';
}
