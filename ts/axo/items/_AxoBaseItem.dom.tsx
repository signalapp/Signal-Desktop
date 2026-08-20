// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC, MouseEvent, ReactNode, Ref } from 'react';
import { memo, useId, useMemo } from 'react';
import {
  createStrictContext,
  useStrictContext,
} from '../_internal/StrictContext.dom.tsx';
import { tw } from '../tw.dom.tsx';
import {
  AriaLabellingProvider,
  useAriaLabellingContext,
  useCreateAriaLabellingContext,
} from '../_internal/AriaLabellingContext.dom.tsx';
import { AriaClickable } from '../AriaClickable.dom.tsx';
import { forwardExtraPropsForRadix } from '../_internal/props.dom.tsx';
import { AxoIconButton } from '../AxoIconButton.dom.tsx';
import { AxoSymbol } from '../AxoSymbol.dom.tsx';
import { AxoButton } from '../AxoButton.dom.tsx';
import { AxoCheckbox } from '../AxoCheckbox.dom.tsx';
import { AxoRadioGroup } from '../AxoRadioGroup.dom.tsx';
import { AxoAvatar } from '../AxoAvatar.dom.tsx';
import { variants } from '../_internal/variants.dom.tsx';

const LEADING_SLOT = 'axo-item-leading-slot';
const CONTENT_SLOT = 'axo-item-content-slot';
const TRAILING_SLOT = 'axo-item-trailing-slot';

const GRID_TEMPLATE_COLUMNS =
  `[${LEADING_SLOT}] min-content ` +
  `[${CONTENT_SLOT}] auto ` +
  `[${TRAILING_SLOT}] min-content`;

/**
 * @example Anatomy
 * ```tsx
 * <AxoBaseItem.Group>
 *   <AxoBaseItem.Root>
 *     <AxoBaseItem.Icon />
 *     <AxoBaseItem.Content>
 *       <AxoBaseItem.Body>
 *         <AxoBaseItem.Title />
 *         <AxoBaseItem.Value />
 *         <AxoBaseItem.Description />
 *         <AxoBaseItem.HiddenTrigger />
 *       </AxoBaseItem.Body>
 *       <AxoBaseItem.Accessory>
 *         <AxoBaseItem.Action />
 *         <AxoBaseItem.IconAction />
 *         <AxoSelect.Root />
 *         <AxoSwitch.Root />
 *       </AxoBaseItem.Accessory>
 *     </AxoBaseItem.Content>
 *     <AxoBaseItem.Arrow />
 *   </AxoBaseItem.Root>
 * </AxoBaseItem.Layout>
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
    spacing: Spacing;
    children: ReactNode;
  }>;

  export const Group: FC<GroupProps> = memo(props => {
    const { spacing } = props;

    const context = useMemo((): GroupContextType => {
      return { spacing };
    }, [spacing]);

    return (
      <GroupContext value={context}>
        <div
          role="list"
          className={tw('grid min-w-90')}
          style={{
            gridTemplateColumns: GRID_TEMPLATE_COLUMNS,
          }}
        >
          {props.children}
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

  export type RootProps = Readonly<{
    children: ReactNode;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    const groupContext = useStrictContext(GroupContext);
    const { context, labelId, descriptionId } = useCreateAriaLabellingContext();

    return (
      <AriaLabellingProvider value={context}>
        <AriaClickable.Root asChild>
          <div
            role="listitem"
            aria-labelledby={labelId}
            aria-describedby={descriptionId}
            className={tw(
              'group',
              // forward grid
              'col-span-full grid grid-cols-subgrid',
              'p-0.5'
            )}
          >
            <div
              className={tw(
                // forward grid
                'col-span-full grid grid-cols-subgrid',
                'gap-x-3 px-3',
                RootSpacing.get(groupContext.spacing),
                'items-baseline',
                'text-primary',
                'curved-14',
                'group-data-hovered:bg-secondary',
                'group-data-pressed:bg-secondary-pressed',
                'outline-none keyboard-mode:group-data-focused:axo-focus-ring'
              )}
            >
              {props.children}
            </div>
          </div>
        </AriaClickable.Root>
      </AriaLabellingProvider>
    );
  });

  Root.displayName = 'AxoBaseItem.Root';

  /**
   * <AxoBaseItem.LeadingSlot>
   * --------------------------------------------------------------------------
   */

  /** @internal */
  type LeadingSlotProps = Readonly<{
    className?: string;
    children: ReactNode;
  }>;

  /** @internal */
  const LeadingSlot: FC<LeadingSlotProps> = memo(props => {
    return (
      <div style={{ gridColumn: LEADING_SLOT }} className={props.className}>
        {props.children}
      </div>
    );
  });

  LeadingSlot.displayName = 'AxoBaseItem.LeadingSlot';

  /**
   * <AxoBaseItem.TrailingSlot>
   * --------------------------------------------------------------------------
   */

  /** @internal */
  type TrailingSlotProps = Readonly<{
    className?: string;
    children: ReactNode;
  }>;

  /** @internal */
  const TrailingSlot: FC<TrailingSlotProps> = memo(props => {
    return (
      <div style={{ gridColumn: TRAILING_SLOT }} className={props.className}>
        {props.children}
      </div>
    );
  });

  TrailingSlot.displayName = 'AxoBaseItem.TrailingSlot';

  /**
   * <AxoBaseItem.Icon>
   * --------------------------------------------------------------------------
   */

  export type IconProps = Readonly<{
    symbol: AxoSymbol.Name;
  }>;

  export const Icon: FC<IconProps> = memo(props => {
    return (
      <LeadingSlot>
        <AxoSymbol.Icon size={18} symbol={props.symbol} label={null} />
      </LeadingSlot>
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
      <LeadingSlot>
        <AxoCheckbox.Root
          id={props.id}
          variant="square"
          checked={props.checked}
          onCheckedChange={props.onCheckedChange}
        />
      </LeadingSlot>
    );
  });

  Checkbox.displayName = 'AxoBaseItem.Checkbox';

  /**
   * <AxoBaseItem.RadioGroupIndicator>
   * --------------------------------------------------------------------------
   */

  export const RadioGroupIndicator: FC = memo(() => {
    return (
      <LeadingSlot>
        <AxoRadioGroup.Indicator />
      </LeadingSlot>
    );
  });

  RadioGroupIndicator.displayName = 'AxoBaseItem.RadioGroupIndicator';

  /**
   * <AxoBaseItem.LegacyAvatarSlot>
   * --------------------------------------------------------------------------
   */

  export type LegacyAvatarSlotProps = Readonly<{
    children: ReactNode;
  }>;

  export const LegacyAvatarSlot: FC<LegacyAvatarSlotProps> = memo(props => {
    return <LeadingSlot>{props.children}</LeadingSlot>;
  });

  LegacyAvatarSlot.displayName = 'AxoBaseItem.LegacyAvatarSlot';

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
      <LeadingSlot>
        <AxoAvatar.Root size={props.size}>
          <AxoAvatar.Content label={null}>
            <AxoAvatar.Icon symbol={props.symbol} />
          </AxoAvatar.Content>
        </AxoAvatar.Root>
      </LeadingSlot>
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
      <div
        style={{ gridColumn: CONTENT_SLOT }}
        className={tw(
          'flex min-w-50 grow basis-0 flex-wrap',
          'self-stretch',
          'items-baseline',
          'gap-x-3 gap-y-2'
        )}
      >
        {props.children}
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
    return (
      <div
        className={tw(
          'flex shrink grow basis-0 flex-wrap',
          'min-w-50', // Note: We need an absolute length for min-width for description to truncate (even if its 0)
          'self-center-safe',
          'gap-x-3 gap-y-0.5'
        )}
      >
        {props.children}
      </div>
    );
  });

  Body.displayName = 'AxoBaseItem.Body';

  /**
   * <AxoBaseItem.Title>
   * --------------------------------------------------------------------------
   */

  export type TitleProps = Readonly<{
    id?: string;
    truncate?: boolean;
    children: ReactNode;
  }>;

  export const Title: FC<TitleProps> = memo(props => {
    const fallbackId = useId();
    const { labelRef } = useAriaLabellingContext('AxoBaseItem.Root');
    return (
      <div
        ref={labelRef}
        id={props.id ?? fallbackId}
        className={tw(
          'min-w-50', // force value to next line if there's not much space
          'grow-[calc(infinity)]',
          'type-body-medium text-primary',
          props.truncate ? 'truncate' : 'line-clamp-2',
          '-my-0.75 py-0.75' // extra space for focus rings
        )}
      >
        {props.children}
      </div>
    );
  });

  Title.displayName = 'AxoBaseItem.Title';

  /**
   * <AxoBaseItem.Value>
   * --------------------------------------------------------------------------
   */

  export type ValueProps = Readonly<{
    children: ReactNode;
  }>;

  export const Value: FC<ValueProps> = memo(props => {
    return (
      <div className={tw('w-fit grow type-body-medium text-secondary')}>
        {props.children}
      </div>
    );
  });

  Value.displayName = 'AxoBaseItem.Value';

  /**
   * <AxoBaseItem.Description>
   * --------------------------------------------------------------------------
   */

  export type DescriptionProps = Readonly<{
    truncate?: boolean;
    children: ReactNode;
  }>;

  export const Description: FC<DescriptionProps> = memo(props => {
    return (
      <>
        {/* Force description to its own line */}
        <div className={tw('basis-full')} />
        <div
          className={tw(
            'min-w-0',
            'type-body-small text-secondary',
            'forced-colors:text-[GrayText]',
            props.truncate && 'truncate',
            '-my-0.5 py-0.5' // extra space for focus rings
          )}
        >
          {props.children}
        </div>
      </>
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
    return (
      <AriaClickable.DeadArea className={tw('flex gap-1.5')}>
        {props.children}
      </AriaClickable.DeadArea>
    );
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
   * <AxoBaseItem.Arrow>
   * --------------------------------------------------------------------------
   */

  export const Arrow: FC = memo(() => {
    return (
      <TrailingSlot
        className={tw('shrink-0 type-body-medium text-placeholder')}
      >
        <AxoSymbol.InlineGlyph label={null} symbol="chevron-[end]" />
      </TrailingSlot>
    );
  });

  Arrow.displayName = 'AxoBaseItem.Arrow';
}
