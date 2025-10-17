// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import type { FC, ReactNode } from 'react';
import { Select } from 'radix-ui';
import { AxoBaseMenu } from './_internal/AxoBaseMenu.dom.js';
import { AxoSymbol } from './AxoSymbol.dom.js';
import type { TailwindStyles } from './tw.dom.js';
import { tw } from './tw.dom.js';
import { ExperimentalAxoBadge } from './AxoBadge.dom.js';

const Namespace = 'AxoSelect';

/**
 * Displays a list of options for the user to pick from—triggered by a button.
 *
 * @example Anatomy
 * ```tsx
 * export default () => (
 *   <AxoSelect.Root>
 *     <AxoSelect.Trigger/>
 *     <AxoSelect.Content>
 *       <AxoSelect.Item>
 *         <AxoSelect.ItemText/>
 *         <AxoSelect.ItemBadge/>
 *       </AxoSelect.Item>
 *       <AxoSelect.Separator/>
 *       <AxoSelect.Group>
 *         <AxoSelect.Label/>
 *         <AxoSelect.Item>
 *           <AxoSelect.ItemText/>
 *         </AxoSelect.Item>
 *       </AxoSelect.Group>
 *     </AxoSelect.Content>
 *   </AxoSelect.Root>
 * );
 * ```
 */
export namespace AxoSelect {
  /**
   * Component: <AxoSelect.Root>
   * ---------------------------
   */

  export type RootProps = Readonly<{
    name?: string;
    form?: string;
    autoComplete?: string;
    disabled?: boolean;
    required?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    value: string | null;
    onValueChange: (value: string) => void;
    children: ReactNode;
  }>;

  /**
   * Contains all the parts of a select.
   */
  export const Root: FC<RootProps> = memo(props => {
    return (
      <Select.Root
        name={props.name}
        form={props.form}
        autoComplete={props.autoComplete}
        disabled={props.disabled}
        required={props.required}
        open={props.open}
        onOpenChange={props.onOpenChange}
        value={props.value ?? undefined}
        onValueChange={props.onValueChange}
      >
        {props.children}
      </Select.Root>
    );
  });

  Root.displayName = `${Namespace}.Root`;

  /**
   * Component: <AxoSelect.Trigger>
   * ---------------------------
   */

  export type TriggerVariant = 'default' | 'floating' | 'borderless';
  export type TriggerWidth = 'hug' | 'full';
  export type TriggerChevron = 'always' | 'on-hover';

  const baseTriggerStyles = tw(
    'group relative flex items-center',
    'rounded-full text-start type-body-medium text-label-primary',
    'disabled:text-label-disabled',
    'outline-0 outline-border-focused focused:outline-[2.5px]',
    'forced-colors:border'
  );

  const TriggerVariants: Record<TriggerVariant, TailwindStyles> = {
    default: tw(
      baseTriggerStyles,
      'bg-fill-secondary',
      'pressed:bg-fill-secondary-pressed'
    ),
    floating: tw(
      baseTriggerStyles,
      'bg-fill-floating',
      'shadow-elevation-1',
      'pressed:bg-fill-floating-pressed'
    ),
    borderless: tw(
      baseTriggerStyles,
      'bg-transparent',
      'hovered:bg-fill-secondary',
      'pressed:bg-fill-secondary-pressed'
    ),
  };

  const TriggerWidths: Record<TriggerWidth, TailwindStyles> = {
    hug: tw(),
    full: tw('w-full'),
  };

  type TriggerChevronConfig = {
    chevronStyles: TailwindStyles;
    contentStyles: TailwindStyles;
  };

  const baseContentStyles = tw('flex min-w-0 flex-1');

  const TriggerChevrons: Record<TriggerChevron, TriggerChevronConfig> = {
    always: {
      chevronStyles: tw('ps-2 pe-2.5'),
      contentStyles: tw(baseContentStyles, 'py-[5px] ps-3'),
    },
    'on-hover': {
      chevronStyles: tw(
        'absolute inset-y-0 end-0 w-9.5',
        'flex items-center justify-end pe-2',
        'opacity-0 group-focus:opacity-100 group-data-[state=open]:opacity-100 group-hovered:opacity-100',
        'transition-opacity duration-150'
      ),
      contentStyles: tw(
        baseContentStyles,
        'px-3 py-[5px]',
        '[--axo-select-trigger-mask-start:black]',
        'group-hovered:[--axo-select-trigger-mask-start:transparent]',
        'group-focus:[--axo-select-trigger-mask-start:transparent]',
        'group-data-[state=open]:[--axo-select-trigger-mask-start:transparent]',
        '[mask-image:linear-gradient(to_left,var(--axo-select-trigger-mask-start)_19px,black_38px)]',
        'rtl:[mask-image:linear-gradient(to_right,var(--axo-select-trigger-mask-start)_19px,black_38px)]',
        '[mask-repeat:no-repeat]',
        '[mask-position:right] rtl:[mask-position:left]',
        '[transition-property:--axo-select-trigger-mask-start] duration-150'
      ),
    },
  };

  export type TriggerProps = Readonly<{
    variant?: TriggerVariant;
    width?: TriggerWidth;
    chevron?: TriggerChevron;
    placeholder: string;
    children?: ReactNode;
  }>;

  /**
   * The button that toggles the select.
   * The {@link AxoSelect.Content} will position itself by aligning over the
   * trigger.
   */
  export const Trigger: FC<TriggerProps> = memo(props => {
    const variant = props.variant ?? 'default';
    const width = props.width ?? 'hug';
    const chevron = props.chevron ?? 'always';
    const variantStyles = TriggerVariants[variant];
    const widthStyles = TriggerWidths[width];
    const chevronConfig = TriggerChevrons[chevron];
    return (
      <Select.Trigger className={tw(variantStyles, widthStyles)}>
        <div className={chevronConfig.contentStyles}>
          <AxoBaseMenu.ItemText>
            <Select.Value placeholder={props.placeholder}>
              {props.children}
            </Select.Value>
          </AxoBaseMenu.ItemText>
        </div>
        <Select.Icon className={chevronConfig.chevronStyles}>
          <AxoSymbol.Icon symbol="chevron-down" size={14} label={null} />
        </Select.Icon>
      </Select.Trigger>
    );
  });

  Trigger.displayName = `${Namespace}.Trigger`;

  /**
   * Component: <AxoSelect.Content>
   * ------------------------------
   */

  export type ContentPosition = 'item-aligned' | 'dropdown';

  type ContentPositionConfig = {
    position: Select.SelectContentProps['position'];
    alignOffset?: Select.SelectContentProps['alignOffset'];
    collisionPadding?: Select.SelectContentProps['collisionPadding'];
    sideOffset?: Select.SelectContentProps['sideOffset'];
  };

  const ContentPositions: Record<ContentPosition, ContentPositionConfig> = {
    'item-aligned': {
      position: 'item-aligned',
    },
    dropdown: {
      position: 'popper',
      alignOffset: 0,
      collisionPadding: 6,
      sideOffset: 8,
    },
  };

  export type ContentProps = Readonly<{
    position?: ContentPosition;
    children: ReactNode;
  }>;

  /**
   * The component that pops out when the select is open.
   * Uses a portal to render the content part into the `body`.
   */
  export const Content: FC<ContentProps> = memo(props => {
    const position = props.position ?? 'item-aligned';
    const positionConfig = ContentPositions[position];
    return (
      <Select.Portal>
        <Select.Content
          className={AxoBaseMenu.selectContentStyles}
          position={positionConfig.position}
          alignOffset={positionConfig.alignOffset}
          collisionPadding={positionConfig.collisionPadding}
          sideOffset={positionConfig.sideOffset}
        >
          <Select.ScrollUpButton
            className={tw(
              'flex items-center justify-center p-1 text-label-primary'
            )}
          >
            <AxoSymbol.Icon symbol="chevron-up" size={14} label={null} />
          </Select.ScrollUpButton>
          <Select.Viewport className={AxoBaseMenu.selectContentViewportStyles}>
            <div className={AxoBaseMenu.menuGroupStyles}>{props.children}</div>
          </Select.Viewport>
          <Select.ScrollDownButton
            className={tw(
              'flex items-center justify-center p-1 text-label-primary'
            )}
          >
            <AxoSymbol.Icon symbol="chevron-down" size={14} label={null} />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    );
  });

  Content.displayName = `${Namespace}.Content`;

  /**
   * Component: <AxoSelect.Item>
   * ---------------------------
   */

  export type ItemProps = Readonly<{
    value: string;
    disabled?: boolean;
    textValue?: string;
    symbol?: AxoSymbol.IconName;
    children: ReactNode;
  }>;

  /**
   * The component that contains the select items.
   */
  export const Item: FC<ItemProps> = memo(props => {
    return (
      <Select.Item
        value={props.value}
        disabled={props.disabled}
        textValue={props.textValue}
        className={AxoBaseMenu.selectItemStyles}
      >
        <AxoBaseMenu.ItemLeadingSlot>
          <AxoBaseMenu.ItemCheckPlaceholder>
            <Select.ItemIndicator>
              <AxoBaseMenu.ItemCheck />
            </Select.ItemIndicator>
          </AxoBaseMenu.ItemCheckPlaceholder>
        </AxoBaseMenu.ItemLeadingSlot>
        <AxoBaseMenu.ItemContentSlot>
          {props.symbol && (
            <span className={tw('me-2')}>
              <AxoBaseMenu.ItemSymbol symbol={props.symbol} />
            </span>
          )}
          {props.children}
        </AxoBaseMenu.ItemContentSlot>
      </Select.Item>
    );
  });

  Item.displayName = `${Namespace}.Content`;

  /**
   * Component: <AxoSelect.ItemText>
   */

  export type ItemTextProps = Readonly<{
    children: ReactNode;
  }>;

  export const ItemText: FC<ItemTextProps> = memo(props => {
    return (
      <AxoBaseMenu.ItemText>
        <Select.ItemText>{props.children}</Select.ItemText>
      </AxoBaseMenu.ItemText>
    );
  });

  ItemText.displayName = `${Namespace}.ItemText`;

  /**
   * Component: <AxoSelect.ItemBadge>
   * --------------------------------
   */

  export type ExperimentalItemBadgeProps = Omit<
    ExperimentalAxoBadge.RootProps,
    'size'
  >;

  export const ExperimentalItemBadge = memo(
    (props: ExperimentalItemBadgeProps) => {
      return (
        <span className={tw('ms-[5px]')}>
          <ExperimentalAxoBadge.Root
            size="sm"
            value={props.value}
            max={props.max}
            maxDisplay={props.maxDisplay}
            aria-label={props['aria-label']}
          />
        </span>
      );
    }
  );

  ExperimentalItemBadge.displayName = `${Namespace}.ItemBadge`;

  /**
   * Component: <AxoSelect.Group>
   * ----------------------------
   */

  export type GroupProps = Readonly<{
    children: ReactNode;
  }>;

  /**
   * Used to group multiple items.
   * Use in conjunction with {@link AxoSelect.Label to ensure good accessibility
   * via automatic labelling.
   */
  export const Group: FC<GroupProps> = memo(props => {
    return (
      <Select.Group className={AxoBaseMenu.selectGroupStyles}>
        {props.children}
      </Select.Group>
    );
  });

  Group.displayName = `${Namespace}.Group`;

  /**
   * Component: <AxoSelect.Label>
   * ---------------------------
   */

  export type LabelProps = Readonly<{
    children: ReactNode;
  }>;

  /**
   * Used to render the label of a group. It won't be focusable using arrow keys.
   */
  export const Label: FC<LabelProps> = memo(props => {
    return (
      <Select.Label className={AxoBaseMenu.selectLabelStyles}>
        <AxoBaseMenu.ItemContentSlot>
          <AxoBaseMenu.ItemText>{props.children}</AxoBaseMenu.ItemText>
        </AxoBaseMenu.ItemContentSlot>
      </Select.Label>
    );
  });

  Label.displayName = `${Namespace}.Label`;

  /**
   * Component: <AxoSelect.Separator>
   * ---------------------------
   */

  export type SeparatorProps = Readonly<{
    // N/A
  }>;

  /**
   * Used to visually separate items in the select.
   */
  export const Separator: FC<SeparatorProps> = memo(() => {
    return <Select.Separator className={AxoBaseMenu.selectSeperatorStyles} />;
  });

  Separator.displayName = `${Namespace}.Separator`;
}
