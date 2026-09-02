// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC, MouseEvent, ReactNode, Ref } from 'react';
import { memo } from 'react';
import type { AxoSymbol } from '../AxoSymbol.dom.tsx';
import type { AxoIconButton } from '../AxoIconButton.dom.tsx';
import { forwardExtraPropsForRadix } from '../_internal/props.dom.tsx';
import { AxoBaseItem } from './_AxoBaseItem.dom.tsx';
import { AriaList } from '../aria/AriaList.dom.tsx';

/**
 * @example Anatomy
 * ```tsx
 * <AxoItem.Group>
 *   <AxoItem.Root>
 *     <AxoItem.Leading>
 *       <AxoItem.Icon />
 *     </AxoItem.Leading>
 *     <AxoItem.Content>
 *       <AxoItem.Body>
 *         <AxoItem.Label />
 *         <AxoItem.Value/>
 *         <AxoItem.Description />
 *         <AxoItem.HiddenTrigger />
 *         <AxoItem.Accessory>
 *           <AxoItem.Action />
 *           <AxoItem.IconAction />
 *           <AxoSelect.Root />
 *           <AxoSwitch.Root />
 *         </AxoItem.Accessory>
 *       </AxoItem.Body>
 *       <AxoItem.Trailing>
 *         <AxoItem.Arrow />
 *       </AxoItem.Trailing>
 *     </AxoItem.Content>
 *   </AxoItem.Root>
 * </AxoItem.Group>
 * ```
 */
export namespace AxoItem {
  /**
   * <AxoItem.Group>
   * --------------------------------------------------------------------------
   */

  export type GroupProps = Readonly<{
    children: ReactNode;
  }>;

  export const Group: FC<GroupProps> = memo(props => {
    return (
      <AriaList.Root asChild>
        <AxoBaseItem.Group spacing="md">{props.children}</AxoBaseItem.Group>
      </AriaList.Root>
    );
  });

  Group.displayName = 'AxoItem.Group';

  /**
   * <AxoItem.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    id?: string;
    /**
     * Dims the contents of the item and disables its `HiddenTrigger`.
     * Accessories (switches, selects, button) must be disabled separately.
     */
    disabled?: boolean;
    children: ReactNode;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    return (
      <AriaList.Item asChild id={props.id}>
        <AxoBaseItem.Root disabled={props.disabled}>
          {props.children}
        </AxoBaseItem.Root>
      </AriaList.Item>
    );
  });

  Root.displayName = 'AxoItem.Root';

  /**
   * <AxoItem.Leading>
   * --------------------------------------------------------------------------
   */

  export type LeadingProps = Readonly<{
    children: ReactNode;
  }>;

  export const Leading: FC<LeadingProps> = memo(props => {
    return <AxoBaseItem.Leading>{props.children}</AxoBaseItem.Leading>;
  });

  Leading.displayName = 'AxoItem.Leading';

  /**
   * <AxoItem.Icon>
   * --------------------------------------------------------------------------
   */

  export type IconProps = Readonly<{
    symbol: AxoSymbol.Name;
  }>;

  export const Icon: FC<IconProps> = memo(props => {
    return <AxoBaseItem.Icon symbol={props.symbol} />;
  });

  Icon.displayName = 'AxoItem.Icon';

  /**
   * <AxoItem.IconAvatar>
   * --------------------------------------------------------------------------
   */

  export type IconAvatarSize = AxoBaseItem.IconAvatarSize;

  export type IconAvatarProps = Readonly<{
    size: IconAvatarSize;
    symbol: AxoSymbol.Name;
  }>;

  export const IconAvatar: FC<IconAvatarProps> = memo(props => {
    return <AxoBaseItem.IconAvatar size={props.size} symbol={props.symbol} />;
  });

  IconAvatar.displayName = 'AxoItem.IconAvatar';

  /**
   * <AxoItem.Content>
   * --------------------------------------------------------------------------
   */

  export type ContentProps = Readonly<{
    children: ReactNode;
  }>;

  export const Content: FC<ContentProps> = memo(props => {
    return <AxoBaseItem.Content>{props.children}</AxoBaseItem.Content>;
  });

  Content.displayName = 'AxoItem.Content';

  /**
   * <AxoItem.Body>
   * --------------------------------------------------------------------------
   */

  export type BodyProps = Readonly<{
    children: ReactNode;
  }>;

  export const Body: FC<BodyProps> = memo(props => {
    return <AxoBaseItem.Body>{props.children}</AxoBaseItem.Body>;
  });

  Body.displayName = 'AxoItem.Body';

  /**
   * <AxoItem.Label>
   * --------------------------------------------------------------------------
   */

  export type LabelProps = Readonly<{
    id?: string;
    children: ReactNode;
  }>;

  export const Label: FC<LabelProps> = memo(props => {
    return (
      <AriaList.Label asChild id={props.id}>
        <AxoBaseItem.Label>{props.children}</AxoBaseItem.Label>
      </AriaList.Label>
    );
  });

  Label.displayName = 'AxoItem.Label';

  /**
   * <AxoItem.Value>
   * --------------------------------------------------------------------------
   */

  export type ValueProps = Readonly<{
    id?: string;
    children: ReactNode;
  }>;

  export const Value: FC<ValueProps> = memo(props => {
    return (
      <AriaList.Label asChild id={props.id}>
        <AxoBaseItem.Value>{props.children}</AxoBaseItem.Value>
      </AriaList.Label>
    );
  });

  Value.displayName = 'AxoItem.Value';

  /**
   * <AxoItem.Description>
   * --------------------------------------------------------------------------
   */

  export type DescriptionProps = Readonly<{
    id?: string;
    children: ReactNode;
  }>;

  export const Description: FC<DescriptionProps> = memo(props => {
    return (
      <AriaList.Description asChild id={props.id}>
        <AxoBaseItem.Description>{props.children}</AxoBaseItem.Description>
      </AriaList.Description>
    );
  });

  Description.displayName = 'AxoItem.Description';

  /**
   * <AxoItem.HiddenTrigger>
   * --------------------------------------------------------------------------
   */

  export type HiddenTriggerProps = Readonly<{
    label?: string;
    labelledby?: string;
    onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  }>;

  export const HiddenTrigger: FC<HiddenTriggerProps> = memo(props => {
    return (
      <AxoBaseItem.HiddenTrigger
        label={props.label}
        labelledby={props.labelledby}
        onClick={props.onClick}
      />
    );
  });

  HiddenTrigger.displayName = 'AxoItem.HiddenTrigger';

  /**
   * <AxoItem.Accessory>
   * --------------------------------------------------------------------------
   */

  export type AccessoryProps = Readonly<{
    children: ReactNode;
  }>;

  export const Accessory: FC<AccessoryProps> = memo(props => {
    return <AxoBaseItem.Accessory>{props.children}</AxoBaseItem.Accessory>;
  });

  Accessory.displayName = 'AxoItem.Accessory';

  /**
   * <AxoItem.Action>
   * --------------------------------------------------------------------------
   */

  export type ActionVariant =
    | 'subtle-secondary'
    | 'strong-affirmative'
    | 'subtle-destructive';

  export type ActionProps = Readonly<{
    ref?: Ref<HTMLButtonElement | null>;
    variant: ActionVariant;
    symbol?: AxoSymbol.Name;
    pending?: boolean;
    onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
    children: ReactNode;
  }>;

  export const Action: FC<ActionProps> = memo(props => {
    const { ref, variant, symbol, pending, onClick, children, ...rest } = props;
    return (
      <AxoBaseItem.Action
        ref={ref}
        variant={variant}
        symbol={symbol}
        pending={pending}
        onClick={onClick}
        {...forwardExtraPropsForRadix(rest)}
      >
        {children}
      </AxoBaseItem.Action>
    );
  });

  Action.displayName = 'AxoItem.Action';

  /**
   * <AxoItem.IconAction>
   * --------------------------------------------------------------------------
   */

  export type IconActionVariant = 'implied-secondary';

  export type IconActionProps = Readonly<{
    ref?: Ref<HTMLButtonElement | null>;
    variant: IconActionVariant;
    label: string;
    symbol: AxoSymbol.Name;
    tooltip?: AxoIconButton.RootProps['tooltip'];
    onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  }>;

  export const IconAction: FC<IconActionProps> = memo(props => {
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

  IconAction.displayName = 'AxoItem.IconAction';

  /**
   * <AxoItem.Trailing>
   * --------------------------------------------------------------------------
   */

  export type TrailingProps = Readonly<{
    children: ReactNode;
  }>;

  export const Trailing: FC<TrailingProps> = memo(props => {
    return <AxoBaseItem.Trailing>{props.children}</AxoBaseItem.Trailing>;
  });

  Trailing.displayName = 'AxoItem.Trailing';

  /**
   * <AxoItem.Arrow>
   * --------------------------------------------------------------------------
   */

  export const Arrow: FC = memo(() => {
    return <AxoBaseItem.Arrow />;
  });

  Arrow.displayName = 'AxoItem.Arrow';
}
