// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC, MouseEvent, ReactNode, Ref } from 'react';
import { memo, useMemo } from 'react';
import {
  createStrictContext,
  useStrictContext,
} from '../_internal/StrictContext.dom.tsx';
import { css } from '../_internal/css.dom.tsx';
import { tw } from '../tw.dom.tsx';
import { AriaClickable } from '../AriaClickable.dom.tsx';
import { forwardExtraPropsForRadix } from '../_internal/props.dom.tsx';
import { AxoIconButton } from '../AxoIconButton.dom.tsx';
import { AxoSymbol } from '../AxoSymbol.dom.tsx';
import { AxoButton } from '../AxoButton.dom.tsx';
import { AxoCheckbox } from '../AxoCheckbox.dom.tsx';
import { AxoAvatar } from '../AxoAvatar.dom.tsx';
import { variants } from '../_internal/variants.dom.tsx';

/**
 * @example Anatomy
 * ```tsx
 * <AxoBaseItem.Group>
 *   <AxoBaseItem.Root>
 *     <AxoBaseItem.Leading>
 *       <AxoBaseItem.Icon />
 *     </AxoBaseItem.Leading>
 *     <AxoBaseItem.Content>
 *       <AxoBaseItem.Body>
 *         <AxoBaseItem.Label />
 *         <AxoBaseItem.Value />
 *         <AxoBaseItem.Description />
 *         <AxoBaseItem.HiddenTrigger />
 *         <AxoBaseItem.Accessory>
 *           <AxoBaseItem.Action />
 *           <AxoBaseItem.IconAction />
 *           <AxoSelect.Root />
 *           <AxoSwitch.Root />
 *         </AxoBaseItem.Accessory>
 *       </AxoBaseItem.Body>
 *       <AxoBaseItem.Trailing>
 *         <AxoBaseItem.Arrow />
 *       </AxoBaseItem.Trailing>
 *     </AxoBaseItem.Content>
 *   </AxoBaseItem.Root>
 * </AxoBaseItem.Group>
 * ```
 */
export namespace AxoBaseItem {
  export type Spacing = 'md' | 'sm';

  /**
   * <AxoBaseItem.Group>
   * --------------------------------------------------------------------------
   */

  type GroupContextType = Readonly<{
    spacing: Spacing;
  }>;

  const GroupContext =
    createStrictContext<GroupContextType>('AxoBaseItem.Group');

  export type GroupProps = Readonly<{
    ref?: Ref<HTMLDivElement>;
    spacing: Spacing;
    children: ReactNode;
  }>;

  export const Group: FC<GroupProps> = memo(props => {
    const { ref, spacing, children, ...rest } = props;

    const context = useMemo((): GroupContextType => {
      return { spacing };
    }, [spacing]);

    return (
      <GroupContext value={context}>
        <div
          ref={ref}
          className="axo-item-group"
          {...forwardExtraPropsForRadix(rest)}
        >
          {children}
        </div>
      </GroupContext>
    );
  });

  Group.displayName = 'AxoBaseItem.Group';

  /**
   * <AxoBaseItem.Root>
   * --------------------------------------------------------------------------
   */

  const RootSpacing = variants<Spacing>('AxoBaseItem.Spacing', {
    md: tw('py-2'),
    sm: tw('py-1.5'),
  });

  export type Variant = 'secondary' | 'destructive';

  const Variants = variants<Variant>('AxoBaseItem.Variant', {
    secondary: tw('text-primary'),
    destructive: tw('text-destructive'),
  });

  const DisabledVariants = variants<Variant>('AxoBaseItem.Root', {
    secondary: tw('text-disabled forced-colors:text-[GrayText]'),
    destructive: tw('text-destructive-disabled forced-colors:text-[GrayText]'),
  });

  /** @internal */
  type RootContextType = Readonly<{
    variant: Variant;
    disabled: boolean;
  }>;

  /** @internal */
  const RootContext = createStrictContext<RootContextType>('AxoBaseItem.Root');

  export type RootProps = Readonly<{
    variant?: Variant;
    /**
     * Dims the contents of the item and disables its `HiddenTrigger`.
     * Accessories (switches, selects, button) must be disabled separately.
     */
    disabled?: boolean;
    children: ReactNode;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    const {
      variant = 'secondary',
      disabled = false,
      children,
      ...rest
    } = props;
    const groupContext = useStrictContext(GroupContext);

    const context = useMemo((): RootContextType => {
      return { variant, disabled };
    }, [variant, disabled]);

    return (
      <RootContext value={context}>
        <AriaClickable.Root asChild>
          <div
            className={css('axo-item-root', tw('group'))}
            {...forwardExtraPropsForRadix(rest)}
          >
            <div
              className={css(
                'axo-item-root-inner',
                RootSpacing.get(groupContext.spacing),
                disabled && tw('text-disabled')
              )}
            >
              {children}
            </div>
          </div>
        </AriaClickable.Root>
      </RootContext>
    );
  });

  Root.displayName = 'AxoBaseItem.Root';

  /**
   * <AxoBaseItem.Leading>
   * --------------------------------------------------------------------------
   */

  export type LeadingProps = Readonly<{
    children: ReactNode;
  }>;

  export const Leading: FC<LeadingProps> = memo(props => {
    return <div className="axo-item-leading">{props.children}</div>;
  });

  Leading.displayName = 'AxoBaseItem.Leading';

  /**
   * <AxoBaseItem.Icon>
   * --------------------------------------------------------------------------
   */

  export type IconProps = Readonly<{
    symbol: AxoSymbol.Name;
  }>;

  export const Icon: FC<IconProps> = memo(props => {
    const { variant, disabled } = useStrictContext(RootContext);
    return (
      <span
        className={
          disabled ? DisabledVariants.get(variant) : Variants.get(variant)
        }
      >
        <AxoSymbol.Icon size={18} symbol={props.symbol} label={null} />
      </span>
    );
  });

  Icon.displayName = 'AxoBaseItem.Icon';

  /**
   * <AxoBaseItem.Checkbox>
   * --------------------------------------------------------------------------
   */

  export type CheckboxProps = Readonly<{
    id?: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
    required?: boolean;
  }>;

  export const Checkbox: FC<CheckboxProps> = memo(props => {
    return (
      <AxoCheckbox.Root
        id={props.id}
        variant="square"
        checked={props.checked}
        onCheckedChange={props.onCheckedChange}
      />
    );
  });

  Checkbox.displayName = 'AxoBaseItem.Checkbox';

  /**
   * <AxoBaseItem.IconAvatar>
   * --------------------------------------------------------------------------
   */

  export type IconAvatarSize = 32 | 36 | 38 | 48;

  export type IconAvatarProps = Readonly<{
    size: IconAvatarSize;
    symbol: AxoSymbol.Name;
  }>;

  export const IconAvatar: FC<IconAvatarProps> = memo(props => {
    return (
      <AxoAvatar.Root size={props.size}>
        <AxoAvatar.Content label={null}>
          <AxoAvatar.Icon symbol={props.symbol} />
        </AxoAvatar.Content>
      </AxoAvatar.Root>
    );
  });

  IconAvatar.displayName = 'AxoBaseItem.IconAvatar';

  /**
   * <AxoBaseItem.Content>
   * --------------------------------------------------------------------------
   */

  export type ContentProps = Readonly<{
    children: ReactNode;
  }>;

  export const Content: FC<ContentProps> = memo(props => {
    return (
      <div className="axo-item-content">
        <div className="axo-item-content-inner">{props.children}</div>
        <div className="axo-item-content-force-scroll-state" />
      </div>
    );
  });

  Content.displayName = 'AxoBaseItem.Content';

  /**
   * <AxoBaseItem.Body>
   * --------------------------------------------------------------------------
   */

  export type BodyProps = Readonly<{
    children: ReactNode;
  }>;

  export const Body: FC<BodyProps> = memo(props => {
    return <div className="axo-item-body">{props.children}</div>;
  });

  Body.displayName = 'AxoBaseItem.Body';

  /**
   * <AxoBaseItem.Title>
   * --------------------------------------------------------------------------
   */

  export type LabelProps = Readonly<{
    ref?: Ref<HTMLDivElement>;
    truncate?: boolean;
    children: ReactNode;
  }>;

  export const Label: FC<LabelProps> = memo(props => {
    const { ref, truncate, children, ...rest } = props;
    const { variant, disabled } = useStrictContext(RootContext);
    return (
      <div
        ref={ref}
        className={css(
          'axo-item-label',
          truncate && tw('truncate'),
          disabled ? DisabledVariants.get(variant) : Variants.get(variant)
        )}
        {...forwardExtraPropsForRadix(rest)}
      >
        {children}
      </div>
    );
  });

  Label.displayName = 'AxoBaseItem.Label';

  /**
   * <AxoBaseItem.Value>
   * --------------------------------------------------------------------------
   */

  export type ValueProps = Readonly<{
    ref?: Ref<HTMLDivElement>;
    children: ReactNode;
  }>;

  export const Value: FC<ValueProps> = memo(props => {
    const { ref, children, ...rest } = props;
    const { disabled } = useStrictContext(RootContext);
    return (
      <div
        ref={ref}
        className={css(
          'axo-item-value',
          disabled && tw('text-disabled forced-colors:text-[GrayText]')
        )}
        {...forwardExtraPropsForRadix(rest)}
      >
        {children}
      </div>
    );
  });

  Value.displayName = 'AxoBaseItem.Value';

  /**
   * <AxoBaseItem.Description>
   * --------------------------------------------------------------------------
   */

  export type DescriptionProps = Readonly<{
    ref?: Ref<HTMLDivElement>;
    truncate?: boolean;
    children: ReactNode;
  }>;

  export const Description: FC<DescriptionProps> = memo(props => {
    const { ref, truncate, children, ...rest } = props;
    const { disabled } = useStrictContext(RootContext);
    return (
      <div
        ref={ref}
        className={css(
          'axo-item-description',
          truncate && tw('truncate'),
          disabled && tw('text-disabled')
        )}
        {...forwardExtraPropsForRadix(rest)}
      >
        {children}
      </div>
    );
  });

  Description.displayName = 'AxoBaseItem.Description';

  /**
   * <AxoBaseItem.Trigger>
   * --------------------------------------------------------------------------
   */

  export type HiddenTriggerProps = Readonly<{
    ref?: Ref<HTMLButtonElement>;
    label?: string;
    labelledby?: string;
    onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  }>;

  export const HiddenTrigger: FC<HiddenTriggerProps> = memo(props => {
    const { disabled } = useStrictContext(RootContext);
    const { ref, label, labelledby, onClick, ...rest } = props;
    return (
      <AriaClickable.HiddenTrigger
        ref={ref}
        label={label}
        labelledby={labelledby}
        disabled={disabled}
        onClick={onClick}
        {...forwardExtraPropsForRadix(rest)}
      />
    );
  });

  HiddenTrigger.displayName = 'AxoBaseItem.HiddenTrigger';

  /**
   * <AxoBaseItem.Accessory>
   * --------------------------------------------------------------------------
   */

  export type AccessoryProps = Readonly<{
    children: ReactNode;
  }>;

  export const Accessory: FC<AccessoryProps> = memo(props => {
    return <div className="axo-item-accessory">{props.children}</div>;
  });

  Accessory.displayName = 'AxoBaseItem.Accessory';

  /**
   * <AxoBaseItem.Action>
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
      <AxoButton.Root
        ref={ref}
        variant={variant}
        size="md"
        symbol={symbol}
        pending={pending}
        onClick={onClick}
        {...forwardExtraPropsForRadix(rest)}
      >
        {children}
      </AxoButton.Root>
    );
  });

  Action.displayName = 'AxoBaseItem.Action';

  /**
   * <AxoBaseItem.IconAction>
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
      <AxoIconButton.Root
        ref={ref}
        variant={variant}
        size="md"
        label={label}
        symbol={symbol}
        onClick={onClick}
        tooltip={tooltip}
        {...forwardExtraPropsForRadix(rest)}
      />
    );
  });

  IconAction.displayName = 'AxoBaseItem.IconAction';

  /**
   * <AxoBaseItem.Trailing>
   * --------------------------------------------------------------------------
   */

  export type TrailingProps = Readonly<{
    children: ReactNode;
  }>;

  export const Trailing: FC<TrailingProps> = memo(props => {
    return <div className="axo-item-trailing">{props.children}</div>;
  });

  Trailing.displayName = 'AxoBaseItem.Trailing';

  /**
   * <AxoBaseItem.Arrow>
   * --------------------------------------------------------------------------
   */

  export type ArrowKind = 'next' | 'external-link';

  const ArrowKinds = variants<ArrowKind, AxoSymbol.Name>(
    'AxoBaseItem.ArrowKind',
    {
      next: 'chevron-[end]',
      'external-link': 'open',
    }
  );

  export type ArrowProps = Readonly<{
    kind?: ArrowKind;
  }>;

  export const Arrow: FC<ArrowProps> = memo(props => {
    const { kind = 'next' } = props;
    const { disabled } = useStrictContext(RootContext);
    return (
      <div
        className={css(
          'axo-item-arrow',
          disabled && tw('text-disabled forced-colors:text-[GrayText]')
        )}
      >
        <AxoSymbol.InlineGlyph label={null} symbol={ArrowKinds.get(kind)} />
      </div>
    );
  });

  Arrow.displayName = 'AxoBaseItem.Arrow';
}
