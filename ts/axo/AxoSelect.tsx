// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import type { FC, ReactNode } from 'react';
import { Select } from 'radix-ui';
import { AxoBaseMenu } from './_internal/AxoBaseMenu';
import { AxoSymbol } from './AxoSymbol';
import type { Styles } from './_internal/css';
import { css } from './_internal/css';

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
 *       <AxoSelect.Item/>
 *       <AxoSelect.Separator/>
 *       <AxoSelect.Group>
 *         <AxoSelect.Label/>
 *         <AxoSelect.Item/>
 *       </AxoSelect.Group>
 *     </AxoSelect.Content>
 *   </Select.Root>
 * );
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
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

  const baseTriggerStyles = css(
    'flex',
    'rounded-full py-[5px] ps-3 pe-2.5 text-label-primary',
    'disabled:text-label-disabled',
    'outline-0 outline-border-focused focused:outline-[2.5px]'
  );

  const TriggerVariants = {
    default: css(
      baseTriggerStyles,
      'bg-fill-secondary',
      'pressed:bg-fill-secondary-pressed'
    ),
    floating: css(
      baseTriggerStyles,
      'bg-fill-floating',
      'shadow-elevation-1',
      'pressed:bg-fill-floating-pressed'
    ),
    borderless: css(
      baseTriggerStyles,
      'bg-transparent',
      'hovered:bg-fill-secondary',
      'pressed:bg-fill-secondary-pressed'
    ),
  } as const satisfies Record<string, Styles>;

  const TriggerWidths = {
    hug: css(),
    fixed: css('w-[120px]'),
  };

  export type TriggerVariant = keyof typeof TriggerVariants;
  export type TriggerWidth = keyof typeof TriggerWidths;

  export type TriggerProps = Readonly<{
    variant?: TriggerVariant;
    width?: TriggerWidth;
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
    const variantStyles = TriggerVariants[variant];
    const widthStyles = TriggerWidths[width];
    return (
      <Select.Trigger className={css(variantStyles, widthStyles)}>
        <AxoBaseMenu.ItemText>
          <Select.Value placeholder={props.placeholder}>
            {props.children}
          </Select.Value>
        </AxoBaseMenu.ItemText>
        <Select.Icon className="ml-2">
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

  export type ContentProps = Readonly<{
    children: ReactNode;
  }>;

  /**
   * The component that pops out when the select is open.
   * Uses a portal to render the content part into the `body`.
   */
  export const Content: FC<ContentProps> = memo(props => {
    return (
      <Select.Portal>
        <Select.Content className={AxoBaseMenu.selectContentStyles}>
          <Select.ScrollUpButton className="flex items-center justify-center p-1 text-label-primary">
            <AxoSymbol.Icon symbol="chevron-up" size={14} label={null} />
          </Select.ScrollUpButton>
          <Select.Viewport className={AxoBaseMenu.selectContentViewportStyles}>
            {props.children}
          </Select.Viewport>
          <Select.ScrollDownButton className="flex items-center justify-center p-1 text-label-primary">
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
          <AxoBaseMenu.ItemText>
            <Select.ItemText>{props.children}</Select.ItemText>
          </AxoBaseMenu.ItemText>
        </AxoBaseMenu.ItemContentSlot>
      </Select.Item>
    );
  });

  Item.displayName = `${Namespace}.Content`;

  /**
   * Component: <AxoSelect.Group>
   * ---------------------------
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
