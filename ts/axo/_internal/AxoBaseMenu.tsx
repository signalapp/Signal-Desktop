// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react';
import type { ReactNode } from 'react';
import { css } from './css';
import { AxoSymbol, type AxoSymbolName } from '../AxoSymbol';

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace AxoBaseMenu {
  // <Content/SubContent>
  const baseContentStyles = css(
    'max-w-[300px] min-w-[200px] p-1.5',
    'select-none',
    'rounded-xl bg-elevated-background-tertiary shadow-elevation-3',
    'data-[state=closed]:animate-fade-out'
  );

  const baseContentGridStyles = css('grid grid-cols-[min-content_auto]');

  // <Group/RadioGroup>
  const baseGroupStyles = css('col-span-full grid grid-cols-subgrid');

  // <Item/RadioItem/CheckboxItem/SubTrigger/Label/Separator>
  const baseItemStyles = css(
    'col-span-full grid grid-cols-subgrid items-center'
  );

  // <Item/RadioItem/CheckboxItem/SubTrigger/Label> (not Separator)
  const labeledItemStyles = css(baseItemStyles, 'truncate p-1.5');

  // <Item/RadioItem/CheckboxItem/SubTrigger> (not Label/Separator)
  const navigableItemStyles = css(
    labeledItemStyles,
    'rounded-md type-body-medium',
    'outline-0 data-[highlighted]:bg-fill-secondary-pressed',
    'data-[disabled]:text-label-disabled',
    'outline-0 outline-border-focused focused:outline-[2.5px]'
  );

  /**
   * <Item/RadioItem/CheckboxItem/SubTrigger> (not Label/Separator)
   */
  type BaseNavigableItemProps = Readonly<{
    /**
     * When true, prevents the user from interacting with the item.
     */
    disabled?: boolean;
    /**
     * Optional text used for typeahead purposes. By default the typeahead
     * behavior will use the .textContent of the item. Use this when the
     * content is complex, or you have non-textual content inside.
     */
    textValue?: string;
    /**
     * An icon that should be rendered before the text.
     */
    symbol?: AxoSymbolName;
  }>;

  // <Item/RadioItem/CheckboxItem> (not SubTrigger/Label/Separator)
  const selectableItemStyles = css(navigableItemStyles);

  /**
   * Used for any selectable content node such as Item, CheckboxItem, or RadioItem,
   * But not nodes like SubTrigger, Separator, Group, etc.
   */
  type BaseSelectableItemProps = BaseNavigableItemProps &
    Readonly<{
      keyboardShortcut?: string;
      onSelect?: (event: Event) => void;
    }>;

  /**
   * AxoBaseMenu: Item Slots
   * -----------------------
   */

  export type ItemLeadingSlotProps = Readonly<{
    children: ReactNode;
  }>;

  export function ItemLeadingSlot(props: ItemLeadingSlotProps): JSX.Element {
    return (
      <span className="col-start-1 col-end-1 me-1.5 flex items-center gap-1.5">
        {props.children}
      </span>
    );
  }

  export type ItemContentSlotProps = Readonly<{
    children: ReactNode;
  }>;

  export function ItemContentSlot(props: ItemContentSlotProps): JSX.Element {
    return (
      <span className="col-start-2 col-end-2 flex min-w-0 items-center">
        {props.children}
      </span>
    );
  }

  /**
   * AxoBaseMenu: Item Parts
   * -----------------------
   */

  export const itemTextStyles = css('flex-1 truncate text-start');

  export type ItemTextProps = Readonly<{
    children: ReactNode;
  }>;

  export function ItemText(props: ItemTextProps): JSX.Element {
    return <span className={itemTextStyles}>{props.children}</span>;
  }

  export type ItemCheckPlaceholderProps = Readonly<{
    children: ReactNode;
  }>;

  export function ItemCheckPlaceholder(
    props: ItemCheckPlaceholderProps
  ): JSX.Element {
    return <span className="w-3.5">{props.children}</span>;
  }

  export function ItemCheck(): JSX.Element {
    return <AxoSymbol.Icon size={14} symbol="check" label={null} />;
  }

  export function ItemSymbol(props: { symbol: AxoSymbolName }): JSX.Element {
    return <AxoSymbol.Icon size={16} symbol={props.symbol} label={null} />;
  }

  export type ItemKeyboardShortcutProps = Readonly<{
    keyboardShortcut: string;
  }>;

  export function ItemKeyboardShortcut(
    props: ItemKeyboardShortcutProps
  ): JSX.Element {
    return (
      <span className="ml-auto px-1 type-body-medium text-label-secondary">
        {props.keyboardShortcut}
      </span>
    );
  }

  /**
   * AxoBaseMenu: Root
   * -----------------
   */

  export type MenuRootProps = Readonly<{
    children: ReactNode;
  }>;

  /**
   * AxoBaseMenu: Trigger
   * --------------------
   */

  export type MenuTriggerProps = Readonly<{
    /**
     * When true, the context menu won't open when right-clicking.
     * Note that this will also restore the native context menu.
     */
    disabled?: boolean;
    children: ReactNode;
  }>;

  /**
   * AxoBaseMenu: Content
   * --------------------
   */

  export type MenuContentProps = Readonly<{
    children: ReactNode;
  }>;

  export const menuContentStyles = css(
    baseContentStyles,
    baseContentGridStyles,
    'max-h-(--radix-popper-available-height) overflow-auto [scrollbar-width:none]',
    'overflow-auto [scrollbar-width:none]'
  );

  export const selectContentStyles = css(baseContentStyles);
  export const selectContentViewportStyles = css(baseContentGridStyles);

  /**
   * AxoBaseMenu: Item
   * -----------------
   */

  export type MenuItemProps = BaseSelectableItemProps &
    Readonly<{
      /**
       * Event handler called when the user selects an item (via mouse or
       * keyboard). Calling event.preventDefault in this handler will prevent the
       * context menu from closing when selecting that item.
       */
      onSelect: (event: Event) => void;
      children: ReactNode;
    }>;

  export const menuItemStyles = css(selectableItemStyles);
  export const selectItemStyles = css(selectableItemStyles);

  /**
   * AxoBaseMenu: Group
   * ------------------
   */

  export type MenuGroupProps = Readonly<{
    children: ReactNode;
  }>;

  export const menuGroupStyles = css(baseGroupStyles);
  export const selectGroupStyles = css(baseGroupStyles);

  /**
   * AxoBaseMenu: Label
   * ------------------
   */

  export type MenuLabelProps = Readonly<{
    children: ReactNode;
  }>;

  const baseLabelStyles = css(
    labeledItemStyles,
    'type-body-small text-label-secondary'
  );

  export const menuLabelStyles = css(baseLabelStyles);
  export const selectLabelStyles = css(baseLabelStyles);

  /**
   * AxoBaseMenu: CheckboxItem
   * -------------------------
   */

  export type MenuCheckboxItemProps = BaseSelectableItemProps &
    Readonly<{
      /**
       * The controlled checked state of the item. Must be used in conjunction
       * with `onCheckedChange`.
       */
      checked: boolean;
      /**
       * Event handler called when the checked state changes.
       */
      onCheckedChange: (checked: boolean) => void;
      children: ReactNode;
    }>;

  export const menuCheckboxItemStyles = css(selectableItemStyles);

  /**
   * AxoBaseMenu: RadioGroup
   * -----------------------
   */

  export type MenuRadioGroupProps = Readonly<{
    /**
     * The value of the selected item in the group.
     */
    value: string;

    /**
     * Event handler called when the value changes.
     */
    onValueChange: (value: string) => void;
    children: ReactNode;
  }>;

  export const menuRadioGroupStyles = css(baseGroupStyles);

  /**
   * AxoBaseMenu: RadioItem
   * ----------------------
   */

  export type MenuRadioItemProps = BaseSelectableItemProps &
    Readonly<{
      value: string;
      children: ReactNode;
    }>;

  export const menuRadioItemStyles = css(selectableItemStyles);

  /**
   * AxoBaseMenu: Separator
   * ----------------------
   */

  export type MenuSeparatorProps = Readonly<{
    // N/A
  }>;

  const baseSeparatorStyles = css(
    baseItemStyles,
    'mx-0.5 my-1 border-t-[0.5px] border-border-primary'
  );

  export const menuSeparatorStyles = css(baseSeparatorStyles);
  export const selectSeperatorStyles = css(baseSeparatorStyles);

  /**
   * AxoBaseMenu: Sub
   * ----------------
   */

  export type MenuSubProps = Readonly<{
    children: ReactNode;
  }>;

  /**
   * AxoBaseMenu: SubTrigger
   * -----------------------
   */

  export type MenuSubTriggerProps = BaseNavigableItemProps &
    Readonly<{
      children: ReactNode;
    }>;

  export const menuSubTriggerStyles = css(
    navigableItemStyles,
    'data-[state=open]:not-data-[highlighted]:bg-fill-secondary'
  );

  /**
   * AxoBaseMenu: SubContent
   * -----------------------
   */

  export type MenuSubContentProps = Readonly<{
    children: ReactNode;
  }>;

  export const menuSubContentStyles = css(
    baseContentStyles,
    'max-h-(--radix-popper-available-height) overflow-auto [scrollbar-width:none]',
    baseContentGridStyles
  );
}
