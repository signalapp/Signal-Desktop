// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { ContextMenu } from 'radix-ui';
import type { FC } from 'react';
import { AxoSymbol } from './AxoSymbol.dom.js';
import { AxoBaseMenu } from './_internal/AxoBaseMenu.dom.js';
import { tw } from './tw.dom.js';

const Namespace = 'AxoContextMenu';

/**
 * Displays a menu located at the pointer, triggered by a right click or a long press.
 *
 * Note: For menus that are triggered by a normal button press, you should use
 * `AxoDropdownMenu`.
 *
 * @example Anatomy
 * ```tsx
 * import { AxoContextMenu } from "./axo/ContextMenu/AxoContentMenu.tsx";
 *
 * export default () => (
 *   <AxoContextMenu.Root>
 *     <AxoContextMenu.Trigger />
 *
 *     <AxoContextMenu.Content>
 *       <AxoContextMenu.Label />
 *       <AxoContextMenu.Item />
 *
 *       <AxoContextMenu.Group>
 *         <AxoContextMenu.Item />
 *       </AxoContextMenu.Group>
 *
 *       <AxoContextMenu.CheckboxItem/>
 *
 *       <AxoContextMenu.RadioGroup>
 *         <AxoContextMenu.RadioItem/>
 *       </AxoContextMenu.RadioGroup>
 *
 *       <AxoContextMenu.Sub>
 *         <AxoContextMenu.SubTrigger />
 *         <AxoContextMenu.SubContent />
 *       </AxoContextMenu.Sub>
 *
 *       <AxoContextMenu.Separator />
 *     </AxoContextMenu.Content>
 *   </AxoContextMenu.Root>
 * )
 * ```
 */
export namespace AxoContextMenu {
  /**
   * Component: <AxoContextMenu.Root>
   * --------------------------------
   */

  export type RootProps = AxoBaseMenu.MenuRootProps;

  export const Root: FC<RootProps> = memo(props => {
    return <ContextMenu.Root>{props.children}</ContextMenu.Root>;
  });

  Root.displayName = `${Namespace}.Root`;

  /**
   * Component: <AxoContextMenu.Trigger>
   * -----------------------------------
   */

  export type TriggerProps = AxoBaseMenu.MenuTriggerProps;

  export const Trigger: FC<TriggerProps> = memo(props => {
    return <ContextMenu.Trigger asChild>{props.children}</ContextMenu.Trigger>;
  });

  Trigger.displayName = `${Namespace}.Trigger`;

  /**
   * Component: <AxoContextMenu.Content>
   * -----------------------------------
   */

  export type ContentProps = AxoBaseMenu.MenuContentProps;

  /**
   * The component that pops out in an open context menu.
   * Uses a portal to render the content part into the `body`.
   */
  export const Content: FC<ContentProps> = memo(props => {
    return (
      <ContextMenu.Portal>
        <ContextMenu.Content
          className={AxoBaseMenu.menuContentStyles}
          alignOffset={-6}
          collisionPadding={6}
        >
          {props.children}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    );
  });

  Content.displayName = `${Namespace}.Content`;

  /**
   * Component: <AxoContextMenu.Item>
   * --------------------------------
   */

  export type ItemProps = AxoBaseMenu.MenuItemProps;

  /**
   * The component that contains the context menu items.
   * @example
   * ```tsx
   * <AxoContextMenu.Item icon={<svg/>}>
   *   {i18n("myContextMenuText")}
   * </AxoContentMenu.Item>
   * ````
   */
  export const Item: FC<ItemProps> = memo(props => {
    return (
      <ContextMenu.Item
        disabled={props.disabled}
        textValue={props.textValue}
        onSelect={props.onSelect}
        className={AxoBaseMenu.menuItemStyles}
      >
        {props.symbol && (
          <AxoBaseMenu.ItemLeadingSlot>
            <AxoBaseMenu.ItemSymbol symbol={props.symbol} />
          </AxoBaseMenu.ItemLeadingSlot>
        )}
        <AxoBaseMenu.ItemContentSlot>
          <AxoBaseMenu.ItemText>{props.children}</AxoBaseMenu.ItemText>
          {props.keyboardShortcut && (
            <AxoBaseMenu.ItemKeyboardShortcut
              keyboardShortcut={props.keyboardShortcut}
            />
          )}
        </AxoBaseMenu.ItemContentSlot>
      </ContextMenu.Item>
    );
  });

  Item.displayName = `${Namespace}.Item`;

  /**
   * Component: <AxoContextMenu.Group>
   * ---------------------------------
   */

  export type GroupProps = AxoBaseMenu.MenuGroupProps;

  /**
   * Used to group multiple {@link AxoContextMenu.Item}'s.
   */
  export const Group: FC<GroupProps> = memo(props => {
    return (
      <ContextMenu.Group className={AxoBaseMenu.menuGroupStyles}>
        {props.children}
      </ContextMenu.Group>
    );
  });

  Group.displayName = `${Namespace}.Group`;

  /**
   * Component: <AxoContextMenu.Label>
   * ---------------------------------
   */

  export type LabelProps = AxoBaseMenu.MenuLabelProps;

  /**
   * Used to render a label. It won't be focusable using arrow keys.
   */
  export const Label: FC<LabelProps> = memo(props => {
    return (
      <ContextMenu.Label className={AxoBaseMenu.menuLabelStyles}>
        <AxoBaseMenu.ItemContentSlot>
          <AxoBaseMenu.ItemText>{props.children}</AxoBaseMenu.ItemText>
        </AxoBaseMenu.ItemContentSlot>
      </ContextMenu.Label>
    );
  });

  Label.displayName = `${Namespace}.Label`;

  /**
   * Component: <AxoContextMenu.CheckboxItem>
   * ----------------------------------------
   */

  export type CheckboxItemProps = AxoBaseMenu.MenuCheckboxItemProps;

  /**
   * An item that can be controlled and rendered like a checkbox.
   */
  export const CheckboxItem: FC<CheckboxItemProps> = memo(props => {
    return (
      <ContextMenu.CheckboxItem
        textValue={props.textValue}
        disabled={props.disabled}
        checked={props.checked}
        onCheckedChange={props.onCheckedChange}
        onSelect={props.onSelect}
        className={AxoBaseMenu.menuCheckboxItemStyles}
      >
        <AxoBaseMenu.ItemLeadingSlot>
          <AxoBaseMenu.ItemCheckPlaceholder>
            <ContextMenu.ItemIndicator>
              <AxoBaseMenu.ItemCheck />
            </ContextMenu.ItemIndicator>
          </AxoBaseMenu.ItemCheckPlaceholder>
        </AxoBaseMenu.ItemLeadingSlot>
        <AxoBaseMenu.ItemContentSlot>
          {props.symbol && (
            <span className={tw('me-2')}>
              <AxoBaseMenu.ItemSymbol symbol={props.symbol} />
            </span>
          )}
          <AxoBaseMenu.ItemText>{props.children}</AxoBaseMenu.ItemText>
          {props.keyboardShortcut && (
            <AxoBaseMenu.ItemKeyboardShortcut
              keyboardShortcut={props.keyboardShortcut}
            />
          )}
        </AxoBaseMenu.ItemContentSlot>
      </ContextMenu.CheckboxItem>
    );
  });

  CheckboxItem.displayName = `${Namespace}.CheckboxItem`;

  /**
   * Component: <AxoContextMenu.RadioGroup>
   * --------------------------------------
   */

  export type RadioGroupProps = AxoBaseMenu.MenuRadioGroupProps;

  /**
   * Used to group multiple {@link AxoContextMenu.RadioItem}'s.
   */
  export const RadioGroup: FC<RadioGroupProps> = memo(props => {
    return (
      <ContextMenu.RadioGroup
        value={props.value ?? undefined}
        onValueChange={props.onValueChange}
        className={AxoBaseMenu.menuRadioGroupStyles}
      >
        {props.children}
      </ContextMenu.RadioGroup>
    );
  });

  RadioGroup.displayName = `${Namespace}.RadioGroup`;

  /**
   * Component: <AxoContextMenu.RadioItem>
   * -------------------------------------
   */

  export type RadioItemProps = AxoBaseMenu.MenuRadioItemProps;

  /**
   * An item that can be controlled and rendered like a radio.
   */
  export const RadioItem: FC<RadioItemProps> = memo(props => {
    return (
      <ContextMenu.RadioItem
        value={props.value}
        className={AxoBaseMenu.menuRadioItemStyles}
        onSelect={props.onSelect}
      >
        <AxoBaseMenu.ItemLeadingSlot>
          <AxoBaseMenu.ItemCheckPlaceholder>
            <ContextMenu.ItemIndicator>
              <AxoBaseMenu.ItemCheck />
            </ContextMenu.ItemIndicator>
          </AxoBaseMenu.ItemCheckPlaceholder>
        </AxoBaseMenu.ItemLeadingSlot>
        <AxoBaseMenu.ItemContentSlot>
          {props.symbol && (
            <span className={tw('me-2')}>
              <AxoBaseMenu.ItemSymbol symbol={props.symbol} />
            </span>
          )}
          <AxoBaseMenu.ItemText>{props.children}</AxoBaseMenu.ItemText>
          {props.keyboardShortcut && (
            <AxoBaseMenu.ItemKeyboardShortcut
              keyboardShortcut={props.keyboardShortcut}
            />
          )}
        </AxoBaseMenu.ItemContentSlot>
      </ContextMenu.RadioItem>
    );
  });

  RadioItem.displayName = `${Namespace}.RadioItem`;

  /**
   * Component: <AxoContextMenu.Separator>
   * -------------------------------------
   */

  export type SeparatorProps = AxoBaseMenu.MenuSeparatorProps;

  /**
   * Used to visually separate items in the context menu.
   */
  export const Separator: FC<SeparatorProps> = memo(() => {
    return (
      <ContextMenu.Separator className={AxoBaseMenu.menuSeparatorStyles} />
    );
  });

  Separator.displayName = `${Namespace}.Separator`;

  /**
   * Component: <AxoContextMenu.Sub>
   * -------------------------------
   */

  export type SubProps = AxoBaseMenu.MenuSubProps;

  /**
   * Contains all the parts of a submenu.
   */
  export const Sub: FC<SubProps> = memo(props => {
    return <ContextMenu.Sub>{props.children}</ContextMenu.Sub>;
  });

  Sub.displayName = `${Namespace}.Sub`;

  /**
   * Component: <AxoContextMenu.SubTrigger>
   * --------------------------------------
   */

  export type SubTriggerProps = AxoBaseMenu.MenuSubTriggerProps;

  /**
   * An item that opens a submenu. Must be rendered inside
   * {@link ContextMenu.Sub}.
   */
  export const SubTrigger: FC<SubTriggerProps> = memo(props => {
    return (
      <ContextMenu.SubTrigger className={AxoBaseMenu.menuSubTriggerStyles}>
        {props.symbol && (
          <AxoBaseMenu.ItemLeadingSlot>
            <AxoBaseMenu.ItemSymbol symbol={props.symbol} />
          </AxoBaseMenu.ItemLeadingSlot>
        )}
        <AxoBaseMenu.ItemContentSlot>
          <AxoBaseMenu.ItemText>{props.children}</AxoBaseMenu.ItemText>
          <span className={tw('ms-auto')}>
            <AxoSymbol.Icon size={14} symbol="chevron-[end]" label={null} />
          </span>
        </AxoBaseMenu.ItemContentSlot>
      </ContextMenu.SubTrigger>
    );
  });

  SubTrigger.displayName = `${Namespace}.SubTrigger`;

  /**
   * Component: <AxoContextMenu.SubContent>
   * --------------------------------------
   */

  export type SubContentProps = AxoBaseMenu.MenuSubContentProps;

  /**
   * The component that pops out when a submenu is open. Must be rendered
   * inside {@link AxoContextMenu.Sub}.
   */
  export const SubContent: FC<SubContentProps> = memo(props => {
    return (
      <ContextMenu.SubContent
        alignOffset={-6}
        collisionPadding={6}
        className={AxoBaseMenu.menuSubContentStyles}
      >
        {props.children}
      </ContextMenu.SubContent>
    );
  });

  SubContent.displayName = `${Namespace}.SubContent`;
}
