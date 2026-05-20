// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode, JSX } from 'react';
import { tw } from '../tw.dom.tsx';
import { AxoSymbol } from '../AxoSymbol.dom.tsx';
import { isTestOrMockEnvironment } from '../../environment.std.ts';

// In the future we should be relying more on insert order of
// dialogs/popovers/menus into portals
const LEGACY_CONTEXT_MENU_Z_INDEX = tw('legacy-z-index-context-menu');

export namespace AxoBaseMenu {
  /**
   * Horizontal alignment of the menu content relative to the trigger.
   * - `start`: Aligns the start edges.
   * - `center`: Centers the content over the trigger.
   * - `end`: Aligns the end edges.
   */
  export type Align = 'center' | 'end' | 'start';

  /**
   * Preferred side of the trigger to render the menu content against.
   */
  export type Side = 'top' | 'right' | 'bottom' | 'left';

  // <Content/SubContent>
  const baseContentStyles = tw(
    LEGACY_CONTEXT_MENU_Z_INDEX,
    'max-w-[300px] min-w-[200px]',
    'select-none',
    'curved-xl bg-elevated-background-tertiary shadow-elevation-3',
    isTestOrMockEnvironment() ||
      'animate-opacity-0 data-[state=closed]:animate-exit',
    'forced-colors:border',
    'forced-colors:bg-[Canvas]',
    'forced-colors:text-[CanvasText]'
  );

  const baseContentGridStyles = tw('grid grid-cols-[min-content_1fr] p-1.5');

  // <Group/RadioGroup>
  const baseGroupStyles = tw('col-span-full grid grid-cols-subgrid');

  // <Item/RadioItem/CheckboxItem/SubTrigger/Label/Separator>
  const baseItemStyles = tw(
    'col-span-full grid grid-cols-subgrid items-center'
  );

  // <Item/RadioItem/CheckboxItem/SubTrigger/Label> (not Separator)
  const labeledItemStyles = tw(baseItemStyles, 'truncate p-1.5');

  // <Item/RadioItem/CheckboxItem/SubTrigger> (not Label/Separator)
  const navigableItemStyles = tw(
    labeledItemStyles,
    'curved-md type-body-medium',
    'text-label-primary',
    'data-highlighted:bg-fill-secondary-pressed',
    'data-disabled:text-label-disabled',
    'outline-none keyboard-mode:focus:outline-focus-ring',
    'forced-colors:text-[CanvasText]',
    'forced-colors:data-highlighted:bg-[Highlight]',
    'forced-colors:data-highlighted:text-[HighlightText]',
    'forced-colors:data-disabled:text-[GrayText]',
    'forced-color-adjust-none'
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
    symbol?: AxoSymbol.IconName;
  }>;

  // <Item/RadioItem/CheckboxItem> (not SubTrigger/Label/Separator)
  const selectableItemStyles = tw(navigableItemStyles);

  /**
   * Used for any selectable content node such as Item, CheckboxItem, or RadioItem,
   * But not nodes like SubTrigger, Separator, Group, etc.
   */
  type BaseSelectableItemProps = BaseNavigableItemProps &
    Readonly<{
      /**
       * Keyboard shortcut hint displayed on the trailing side of the item
       * (e.g. `"⌘C"`).
       * Note: Decorative, does not register the shortcut.
       */
      keyboardShortcut?: string;
      /**
       * Called when the item is selected via mouse or keyboard.
       * Call `event.preventDefault()` to keep the menu open after selection.
       */
      onSelect?: (event: Event) => void;
    }>;

  /**
   * <AxoBaseMenu.ItemLeadingSlot>
   * --------------------------------------------------------------------------
   */

  export type ItemLeadingSlotProps = Readonly<{
    children: ReactNode;
  }>;

  /**
   * First grid column of a menu item row. Holds the icon or check indicator.
   */
  export function ItemLeadingSlot(props: ItemLeadingSlotProps): JSX.Element {
    return (
      <span
        className={tw('col-start-1 col-end-1 me-1.5 flex items-center gap-1.5')}
      >
        {props.children}
      </span>
    );
  }

  /**
   * <AxoBaseMenu.ItemContentSlot>
   * --------------------------------------------------------------------------
   */

  export type ItemContentSlotProps = Readonly<{
    children: ReactNode;
  }>;

  /**
   * Second grid column of a menu item row. Holds the label and keyboard shortcut.
   */
  export function ItemContentSlot(props: ItemContentSlotProps): JSX.Element {
    return (
      <span className={tw('col-start-2 col-end-2 flex min-w-0 items-center')}>
        {props.children}
      </span>
    );
  }

  /**
   * <AxoBaseMenu.ItemText>
   * --------------------------------------------------------------------------
   */

  export const itemTextStyles = tw('flex-auto grow-0 truncate text-start');

  export type ItemTextProps = Readonly<{
    children: ReactNode;
  }>;

  /**
   * Truncated label text inside a menu item.
   */
  export function ItemText(props: ItemTextProps): JSX.Element {
    return <span className={itemTextStyles}>{props.children}</span>;
  }

  /**
   * <AxoBaseMenu.ItemCheckPlaceholder>
   * --------------------------------------------------------------------------
   */

  export type ItemCheckPlaceholderProps = Readonly<{
    children: ReactNode;
  }>;

  /**
   * Fixed-width container for the check indicator. Reserves horizontal space
   * even when unchecked so item text stays aligned across all items.
   */
  export function ItemCheckPlaceholder(
    props: ItemCheckPlaceholderProps
  ): JSX.Element {
    return <span className={tw('w-3.5')}>{props.children}</span>;
  }

  /**
   * <AxoBaseMenu.ItemCheck>
   * --------------------------------------------------------------------------
   */

  /**
   * The checkmark icon rendered inside `ItemCheckPlaceholder` when
   * a checkbox or radio item is in a checked state.
   */
  export function ItemCheck(): JSX.Element {
    return <AxoSymbol.Icon size={14} symbol="check" label={null} />;
  }

  /**
   * <AxoBaseMenu.ItemSymbol>
   * --------------------------------------------------------------------------
   */

  export type ItemSymbolProps = Readonly<{
    symbol: AxoSymbol.IconName;
  }>;

  /**
   * An icon rendered in the leading slot of a menu item.
   */
  export function ItemSymbol(props: ItemSymbolProps): JSX.Element {
    return <AxoSymbol.Icon size={16} symbol={props.symbol} label={null} />;
  }

  /**
   * <AxoBaseMenu.ItemKeyboardShortcut>
   * --------------------------------------------------------------------------
   */

  export type ItemKeyboardShortcutProps = Readonly<{
    keyboardShortcut: string;
  }>;

  /**
   * Right-aligned keyboard shortcut hint (e.g. `"⌘C"`) inside a menu item.
   */
  export function ItemKeyboardShortcut(
    props: ItemKeyboardShortcutProps
  ): JSX.Element {
    return (
      <span
        dir="auto"
        className={tw(
          'ms-auto px-1 type-body-medium text-label-secondary forced-colors:text-inherit'
        )}
      >
        {props.keyboardShortcut}
      </span>
    );
  }

  /**
   * <AxoBaseMenu.Root>
   * --------------------------------------------------------------------------
   */

  export type MenuRootProps = Readonly<{
    /**
     * Note: Radix context menus don't have an `open` prop
     * so we have to push it down to the dropdown menu props
     */
    onOpenChange?: (open: boolean) => void;
    /**
     * When `true`, pointer events outside the menu are disabled while it's open.
     * Defaults to `true` for dropdown menus.
     */
    modal?: boolean;
    children: ReactNode;
  }>;

  /**
   * <AxoBaseMenu.Trigger>
   * --------------------------------------------------------------------------
   */

  export type MenuTriggerProps = Readonly<{
    /**
     * When true, the menu won't open when right-clicking.
     * Note that this will also restore the native context menu.
     */
    disabled?: boolean;
    children: ReactNode;
  }>;

  /**
   * <AxoBaseMenu.Content>
   * --------------------------------------------------------------------------
   */

  export type MenuContentProps = Readonly<{
    /**
     * Horizontal alignment of the content relative to the trigger.
     * Only applies to `AxoDropdownMenu`.
     */
    align?: Align;
    /**
     * Preferred side of the trigger to render the content against.
     * Only applies to `AxoDropdownMenu`.
     */
    side?: Side;
    /**
     * Called when focus would be restored after the menu closes.
     * Call `event.preventDefault()` to suppress auto-focus restoration.
     */
    onCloseAutoFocus?: (e: Event) => void;
    children: ReactNode;
  }>;

  export const menuContentStyles = tw(
    baseContentStyles,
    baseContentGridStyles,
    'max-h-(--radix-popper-available-height) scrollbar-width-none overflow-auto',
    'scrollbar-width-none overflow-auto'
  );

  export const selectContentStyles = tw(baseContentStyles);
  export const selectContentViewportStyles = tw(baseContentGridStyles);

  /**
   * <AxoBaseMenu.Item>
   * --------------------------------------------------------------------------
   */

  export type MenuItemProps = BaseSelectableItemProps &
    Readonly<{
      /**
       * Event handler called when the user selects an item (via mouse or
       * keyboard). Calling `event.preventDefault()` in this handler will
       * prevent the context menu from closing when selecting that item.
       */
      onSelect: (event: Event) => void;
      children: ReactNode;
    }>;

  export const menuItemStyles = tw(selectableItemStyles);
  export const selectItemStyles = tw(selectableItemStyles);

  /**
   * <AxoBaseMenu.Group>
   * --------------------------------------------------------------------------
   */

  export type MenuGroupProps = Readonly<{
    children: ReactNode;
  }>;

  export const menuGroupStyles = tw(baseGroupStyles);
  export const selectGroupStyles = tw(baseGroupStyles);

  /**
   * <AxoBaseMenu.Label>
   * --------------------------------------------------------------------------
   */

  export type MenuLabelProps = Readonly<{
    children: ReactNode;
  }>;

  const baseLabelStyles = tw(
    labeledItemStyles,
    'type-body-small text-label-secondary'
  );

  export const menuLabelStyles = tw(baseLabelStyles);
  export const selectLabelStyles = tw(baseLabelStyles);

  /**
   * <AxoBaseMenu.Header>
   * --------------------------------------------------------------------------
   */

  export const menuHeaderStyles = tw('col-span-full col-start-1 p-1.5');
  export const menuHeaderLabelStyles = tw(
    'block truncate type-title-small text-label-primary'
  );
  export const menuHeaderDescriptionStyles = tw(
    'block truncate type-caption text-label-secondary'
  );

  /**
   * <AxoBaseMenu.CheckboxItem>
   * --------------------------------------------------------------------------
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

  export const menuCheckboxItemStyles = tw(selectableItemStyles);

  /**
   * <AxoBaseMenu.RadioGroup>
   * --------------------------------------------------------------------------
   */

  export type MenuRadioGroupProps = Readonly<{
    /**
     * The value of the selected item in the group.
     */
    value: string | null;
    /**
     * Event handler called when the value changes.
     */
    onValueChange: (value: string) => void;
    children: ReactNode;
  }>;

  export const menuRadioGroupStyles = tw(baseGroupStyles);

  /**
   * <AxoBaseMenu.RadioItem>
   * --------------------------------------------------------------------------
   */

  export type MenuRadioItemProps = BaseSelectableItemProps &
    Readonly<{
      /**
       * The value submitted when this item is selected.
       */
      value: string;
      children: ReactNode;
    }>;

  export const menuRadioItemStyles = tw(selectableItemStyles);

  /**
   * <AxoBaseMenu.Separator>
   * --------------------------------------------------------------------------
   */

  const baseSeparatorStyles = tw('my-1 border-t-[0.5px] border-border-primary');

  export const menuSeparatorStyles = tw(
    'col-span-full col-start-1 mx-0.5',
    baseSeparatorStyles
  );
  export const menuContentSeparatorStyles = tw(
    'col-span-full col-start-2',
    baseSeparatorStyles
  );
  export const selectSeperatorStyles = tw(baseItemStyles, baseSeparatorStyles);

  /**
   * <AxoBaseMenu.Sub>
   * --------------------------------------------------------------------------
   */

  export type MenuSubProps = Readonly<{
    children: ReactNode;
  }>;

  /**
   * <AxoBaseMenu.SubTrigger>
   * --------------------------------------------------------------------------
   */

  export type MenuSubTriggerProps = BaseNavigableItemProps &
    Readonly<{
      children: ReactNode;
    }>;

  export const menuSubTriggerStyles = tw(
    navigableItemStyles,
    'data-[state=open]:not-data-highlighted:bg-fill-secondary',
    'forced-colors:data-[state=open]:not-data-highlighted:bg-[Highlight]',
    'forced-colors:data-[state=open]:not-data-highlighted:text-[HighlightText]'
  );

  /**
   * <AxoBaseMenu.SubContent>
   * --------------------------------------------------------------------------
   */

  export type MenuSubContentProps = Readonly<{
    children: ReactNode;
  }>;

  export const menuSubContentStyles = tw(
    baseContentStyles,
    'max-h-(--radix-popper-available-height) scrollbar-width-none overflow-auto',
    baseContentGridStyles
  );
}
