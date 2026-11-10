// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode, JSX, SyntheticEvent } from 'react';
import { AxoSymbol } from '../AxoSymbol.dom.tsx';
import { assert } from '../_internal/assert.std.tsx';
import { css } from '../_internal/css.dom.tsx';
import { variants } from '../_internal/variants.dom.tsx';
import type { TailwindStyles } from '../tw.dom.tsx';

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
    symbol?: AxoSymbol.Name;
  }>;

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
    return <span className="axo-menu-item-leading">{props.children}</span>;
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
    return <span className="axo-menu-item-content">{props.children}</span>;
  }

  /**
   * <AxoBaseMenu.ItemText>
   * --------------------------------------------------------------------------
   */

  export type ItemTextProps = Readonly<{
    children: ReactNode;
  }>;

  /**
   * Truncated label text inside a menu item.
   */
  export function ItemText(props: ItemTextProps): JSX.Element {
    return <span className="axo-menu-item-text">{props.children}</span>;
  }

  /**
   * <AxoBaseMenu.ItemTextWithDescription>
   * --------------------------------------------------------------------------
   */

  export type ItemTextWithDescriptionProps = Readonly<{
    textId: string;
    descriptionId: string;
    description: ReactNode;
    children: ReactNode;
  }>;

  /**
   * Truncated label text with a wrapping description below it.
   *
   * The item should set `aria-labelledby={textId}` and
   * `aria-describedby={descriptionId}`, otherwise the description gets merged
   * into the item's accessible name.
   */
  export function ItemTextWithDescription(
    props: ItemTextWithDescriptionProps
  ): JSX.Element {
    return (
      <span className="axo-menu-item-text-with-description">
        <span id={props.textId} className="axo-menu-item-text">
          {props.children}
        </span>
        <span id={props.descriptionId} className="axo-menu-item-description">
          {props.description}
        </span>
      </span>
    );
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
    return (
      <span className="axo-menu-item-check-placeholder">{props.children}</span>
    );
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
    symbol: AxoSymbol.Name;
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
      <span dir="auto" className="axo-menu-item-keyboard-shortcut">
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

  export function menuContentEventStopPropagation(
    event: SyntheticEvent | Event
  ): void {
    assert(
      event.type !== 'pointerdown',
      'Radix needs pointerdown to reach the document to detect clicks outside of the menu'
    );
    event.stopPropagation();
  }

  /**
   * <AxoBaseMenu.Item>
   * --------------------------------------------------------------------------
   */

  /** Visual style of an item. */
  export type ItemVariant = 'secondary' | 'destructive';

  const ItemVariants = variants<ItemVariant>('AxoBaseMenu.ItemVariant', {
    secondary: css(),
    destructive: css('axo-menu-item-destructive'),
  });

  export function getItemVariantClassName(
    variant: ItemVariant
  ): TailwindStyles {
    return ItemVariants.get(variant);
  }

  export type MenuItemProps = BaseSelectableItemProps &
    Readonly<{
      /** Defaults to `secondary`. */
      variant?: ItemVariant;
      /**
       * Event handler called when the user selects an item (via mouse or
       * keyboard). Calling `event.preventDefault()` in this handler will
       * prevent the context menu from closing when selecting that item.
       */
      onSelect: (event: Event) => void;
      /**
       * Secondary text displayed below the label.
       * Exposed as the item's accessible description rather than its name.
       */
      description?: ReactNode;
      children: ReactNode;
    }>;

  /**
   * <AxoBaseMenu.Group>
   * --------------------------------------------------------------------------
   */

  export type MenuGroupProps = Readonly<{
    children: ReactNode;
  }>;

  /**
   * <AxoBaseMenu.Label>
   * --------------------------------------------------------------------------
   */

  export type MenuLabelProps = Readonly<{
    children: ReactNode;
  }>;

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

  /**
   * <AxoBaseMenu.SubContent>
   * --------------------------------------------------------------------------
   */

  export type MenuSubContentProps = Readonly<{
    children: ReactNode;
  }>;
}
