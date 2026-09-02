// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC, MouseEvent, ReactNode, Ref } from 'react';
import { memo, useMemo } from 'react';
import {
  createStrictContext,
  useStrictContext,
} from '../_internal/StrictContext.dom.tsx';
import { tw } from '../tw.dom.tsx';
import { AriaClickable } from '../AriaClickable.dom.tsx';
import { forwardExtraPropsForRadix } from '../_internal/props.dom.tsx';
import { AxoIconButton } from '../AxoIconButton.dom.tsx';
import { AxoSymbol } from '../AxoSymbol.dom.tsx';
import { AxoButton } from '../AxoButton.dom.tsx';
import { AxoCheckbox } from '../AxoCheckbox.dom.tsx';
import { AxoAvatar } from '../AxoAvatar.dom.tsx';
import { variants } from '../_internal/variants.dom.tsx';
import { FlexWrapDetector } from '../_internal/FlexWrapDetector.dom.tsx';

const AXO_ITEM_GROUP_CLASS = 'axo-item-group';
const AXO_ITEM_ROOT_CLASS = 'axo-item-root';
const AXO_ITEM_ROOT_INNER_CLASS = 'axo-item-root-inner';
const AXO_ITEM_LEADING_CLASS = 'axo-item-leading';
const AXO_ITEM_CONTENT_CLASS = 'axo-item-content';
const AXO_ITEM_CONTENT_INNER_CLASS = 'axo-item-content-inner';
const AXO_ITEM_BODY_CLASS = 'axo-item-body';
const AXO_ITEM_LABEL_CLASS = 'axo-item-label';
const AXO_ITEM_ACCESSORY_CLASS = 'axo-item-accessory';
const AXO_ITEM_VALUE_CLASS = 'axo-item-value';
const AXO_ITEM_DESCRIPTION_CLASS = 'axo-item-description';
const AXO_ITEM_TRAILING_CLASS = 'axo-item-trailing';
const AXO_ITEM_ARROW_CLASS = 'axo-item-arrow';

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
          className={AXO_ITEM_GROUP_CLASS}
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

  /** @internal */
  type RootContextType = Readonly<{
    disabled: boolean;
  }>;

  /** @internal */
  const RootContext = createStrictContext<RootContextType>('AxoBaseItem.Root');

  /** @internal */
  function useRootDisabled(): boolean {
    return useStrictContext(RootContext).disabled;
  }

  export type RootProps = Readonly<{
    /**
     * Dims the contents of the item and disables its `HiddenTrigger`.
     * Accessories (switches, selects, button) must be disabled separately.
     */
    disabled?: boolean;
    children: ReactNode;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    const { disabled = false, children, ...rest } = props;
    const groupContext = useStrictContext(GroupContext);

    const context = useMemo((): RootContextType => {
      return { disabled };
    }, [disabled]);

    return (
      <RootContext value={context}>
        <AriaClickable.Root asChild>
          <div
            className={tw(AXO_ITEM_ROOT_CLASS, 'group')}
            {...forwardExtraPropsForRadix(rest)}
          >
            <div
              className={tw(
                AXO_ITEM_ROOT_INNER_CLASS,
                RootSpacing.get(groupContext.spacing),
                disabled && 'text-disabled'
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
    return <div className={AXO_ITEM_LEADING_CLASS}>{props.children}</div>;
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
    return <AxoSymbol.Icon size={18} symbol={props.symbol} label={null} />;
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
      <div className={AXO_ITEM_CONTENT_CLASS}>
        <FlexWrapDetector>
          <div className={AXO_ITEM_CONTENT_INNER_CLASS}>{props.children}</div>
        </FlexWrapDetector>
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
    return <div className={AXO_ITEM_BODY_CLASS}>{props.children}</div>;
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
    const disabled = useRootDisabled();
    return (
      <div
        ref={ref}
        className={tw(
          AXO_ITEM_LABEL_CLASS,
          truncate && 'truncate',
          disabled && 'text-disabled forced-colors:text-[GrayText]'
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
    const disabled = useRootDisabled();
    return (
      <div
        ref={ref}
        className={tw(
          AXO_ITEM_VALUE_CLASS,
          disabled && 'text-disabled forced-colors:text-[GrayText]'
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
    const disabled = useRootDisabled();
    return (
      <div
        ref={ref}
        className={tw(
          AXO_ITEM_DESCRIPTION_CLASS,
          truncate && 'truncate',
          disabled && 'text-disabled'
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
    label?: string;
    labelledby?: string;
    onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  }>;

  export const HiddenTrigger: FC<HiddenTriggerProps> = memo(props => {
    const disabled = useRootDisabled();

    if (disabled) {
      return null;
    }

    return (
      <AriaClickable.HiddenTrigger
        label={props.label}
        labelledby={props.labelledby}
        onClick={props.onClick}
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
    return <div className={AXO_ITEM_ACCESSORY_CLASS}>{props.children}</div>;
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
    return <div className={AXO_ITEM_TRAILING_CLASS}>{props.children}</div>;
  });

  Trailing.displayName = 'AxoBaseItem.Trailing';

  /**
   * <AxoBaseItem.Arrow>
   * --------------------------------------------------------------------------
   */

  export const Arrow: FC = memo(() => {
    const disabled = useRootDisabled();
    return (
      <div
        className={tw(
          AXO_ITEM_ARROW_CLASS,
          disabled && 'text-disabled forced-colors:text-[GrayText]'
        )}
      >
        <AxoSymbol.InlineGlyph label={null} symbol="chevron-[end]" />
      </div>
    );
  });

  Arrow.displayName = 'AxoBaseItem.Arrow';
}
