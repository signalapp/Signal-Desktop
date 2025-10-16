// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useId } from 'react';
import { DropdownMenu } from 'radix-ui';
import type { FC, ReactNode } from 'react';
import { AxoSymbol } from './AxoSymbol.dom.js';
import { AxoBaseMenu } from './_internal/AxoBaseMenu.dom.js';
import { tw } from './tw.dom.js';
import {
  AriaLabellingProvider,
  useAriaLabellingContext,
  useCreateAriaLabellingContext,
} from './_internal/AriaLabellingContext.dom.js';

const Namespace = 'AxoDropdownMenu';

/**
 * Displays a menu to the user—such as a set of actions or functions—triggered
 * by a button.
 *
 * Note: For menus that are triggered by a right-click, you should use
 * `AxoContextMenu`.
 *
 * @example Anatomy
 * ```tsx
 * import { AxoDropdownMenu } from "./axo/DropdownMenu/AxoDropdownMenu.tsx";
 *
 * export default () => (
 *   <AxoDropdownMenu.Root>
 *     <AxoDropdownMenu.Trigger>
 *       <button>Click Me</button>
 *     </AxoDropdownMenu.Trigger>
 *
 *     <AxoDropdownMenu.Content>
 *       <AxoDropdownMenu.Label />
 *       <AxoDropdownMenu.Item />
 *
 *       <AxoDropdownMenu.Group>
 *         <AxoDropdownMenu.Item />
 *       </AxoDropdownMenu.Group>
 *
 *       <AxoDropdownMenu.CheckboxItem/>
 *
 *       <AxoDropdownMenu.RadioGroup>
 *         <AxoDropdownMenu.RadioItem/>
 *       </AxoDropdownMenu.RadioGroup>
 *
 *       <AxoDropdownMenu.Sub>
 *         <AxoDropdownMenu.SubTrigger />
 *         <AxoDropdownMenu.SubContent />
 *       </AxoDropdownMenu.Sub>
 *
 *       <AxoDropdownMenu.Separator />
 *     </AxoDropdownMenu.Content>
 *   </AxoDropdownMenu.Root>
 * )
 * ```
 */
export namespace AxoDropdownMenu {
  /**
   * Component: <AxoDropdownMenu.Root>
   * ---------------------------------
   */

  export type RootProps = AxoBaseMenu.MenuRootProps &
    Readonly<{
      open?: boolean;
      onOpenChange?: (open: boolean) => void;
    }>;

  /**
   * Contains all the parts of a dropdown menu.
   */
  export const Root: FC<RootProps> = memo(props => {
    return (
      <DropdownMenu.Root open={props.open} onOpenChange={props.onOpenChange}>
        {props.children}
      </DropdownMenu.Root>
    );
  });

  Root.displayName = `${Namespace}.Root`;

  /**
   * Component: <AxoDropdownMenu.Trigger>
   * ------------------------------------
   */

  export type TriggerProps = AxoBaseMenu.MenuTriggerProps;

  /**
   * The button that toggles the dropdown menu.
   * By default, the {@link AxoDropdownMenu.Content} will position itself
   * against the trigger.
   */
  export const Trigger: FC<TriggerProps> = memo(props => {
    return (
      <DropdownMenu.Trigger asChild>{props.children}</DropdownMenu.Trigger>
    );
  });

  Trigger.displayName = `${Namespace}.Trigger`;

  /**
   * Component: <AxoDropdownMenu.Content>
   * ------------------------------------
   */

  export type ContentProps = AxoBaseMenu.MenuContentProps;

  /**
   * The component that pops out when the dropdown menu is open.
   * Uses a portal to render the content part into the `body`.
   */
  export const Content: FC<ContentProps> = memo(props => {
    const { context, labelId, descriptionId } = useCreateAriaLabellingContext();
    return (
      <AriaLabellingProvider value={context}>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            sideOffset={4}
            align="start"
            collisionPadding={6}
            className={AxoBaseMenu.menuContentStyles}
            aria-labelledby={labelId}
            aria-describedby={descriptionId}
          >
            {props.children}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </AriaLabellingProvider>
    );
  });

  Content.displayName = `${Namespace}.Content`;

  /**
   * Component: <AxoDropdownMenu.CustomItem>
   * -------------------------------------
   */

  export type CustomItemProps = Pick<
    AxoBaseMenu.MenuItemProps,
    'disabled' | 'textValue' | 'keyboardShortcut' | 'onSelect'
  > &
    Readonly<{
      leading?: ReactNode;
      // trailing?: ReactNode;
      text: ReactNode;
      // prefix?: ReactNode;
      suffix?: ReactNode;
    }>;

  export const CustomItem: FC<CustomItemProps> = memo(props => {
    return (
      <DropdownMenu.Item
        disabled={props.disabled}
        textValue={props.textValue}
        onSelect={props.onSelect}
        className={AxoBaseMenu.menuItemStyles}
      >
        {props.leading && (
          <AxoBaseMenu.ItemLeadingSlot>
            {props.leading}
          </AxoBaseMenu.ItemLeadingSlot>
        )}
        <AxoBaseMenu.ItemContentSlot>
          <AxoBaseMenu.ItemText>{props.text}</AxoBaseMenu.ItemText>
          {props.suffix}
        </AxoBaseMenu.ItemContentSlot>
      </DropdownMenu.Item>
    );
  });

  CustomItem.displayName = `${Namespace}.CustomItem`;

  /**
   * Component: <AxoDropdownMenu.Item>
   * ---------------------------------
   */

  export type ItemProps = AxoBaseMenu.MenuItemProps;

  /**
   * The component that contains the dropdown menu items.
   * @example
   * ```tsx
   * <AxoDropdownMenu.Item icon={<svg/>}>
   *   {i18n("myContextMenuText")}
   * </AxoContentMenu.Item>
   * ````
   */
  export const Item: FC<ItemProps> = memo(props => {
    return (
      <DropdownMenu.Item
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
      </DropdownMenu.Item>
    );
  });

  Item.displayName = `${Namespace}.Item`;

  /**
   * Component: <AxoDropdownMenu.Group>
   * ----------------------------------
   */

  export type GroupProps = AxoBaseMenu.MenuGroupProps;

  /**
   * Used to group multiple {@link AxoDropdownMenu.Item}'s.
   */
  export const Group: FC<GroupProps> = memo(props => {
    return (
      <DropdownMenu.Group className={AxoBaseMenu.menuGroupStyles}>
        {props.children}
      </DropdownMenu.Group>
    );
  });

  Group.displayName = `${Namespace}.Group`;

  /**
   * Component: <AxoDropdownMenu.Label>
   * ----------------------------------
   */

  export type LabelProps = AxoBaseMenu.MenuLabelProps;

  /**
   * Used to render a label. It won't be focusable using arrow keys.
   */
  export const Label: FC<LabelProps> = memo(props => {
    return (
      <DropdownMenu.Label className={AxoBaseMenu.menuLabelStyles}>
        <AxoBaseMenu.ItemContentSlot>
          <AxoBaseMenu.ItemText>{props.children}</AxoBaseMenu.ItemText>
        </AxoBaseMenu.ItemContentSlot>
      </DropdownMenu.Label>
    );
  });

  Label.displayName = `${Namespace}.Label`;

  /**
   * Component: <AxoDropdownMenu.Header>
   * -----------------------------------
   */

  export type HeaderProps = Readonly<{
    label: ReactNode;
    description?: ReactNode;
  }>;

  export const Header: FC<HeaderProps> = memo(props => {
    const labelId = useId();
    const descriptionId = useId();

    const { labelRef, descriptionRef } = useAriaLabellingContext(
      `<${Namespace}.Header>`,
      `<${Namespace}.Content/SubContent>`
    );

    return (
      <span aria-hidden="true" className={AxoBaseMenu.menuHeaderStyles}>
        <span
          ref={labelRef}
          id={labelId}
          className={AxoBaseMenu.menuHeaderLabelStyles}
        >
          {props.label}
        </span>
        {props.description && (
          <span
            ref={descriptionRef}
            id={descriptionId}
            className={AxoBaseMenu.menuHeaderDescriptionStyles}
          >
            {props.description}
          </span>
        )}
      </span>
    );
  });

  Header.displayName = `${Namespace}.Header`;

  /**
   * Component: <AxoDropdownMenu.CheckboxItem>
   * -----------------------------------------
   */

  export type CheckboxItemProps = AxoBaseMenu.MenuCheckboxItemProps;

  /**
   * An item that can be controlled and rendered like a checkbox.
   */
  export const CheckboxItem: FC<CheckboxItemProps> = memo(props => {
    return (
      <DropdownMenu.CheckboxItem
        textValue={props.textValue}
        disabled={props.disabled}
        checked={props.checked}
        onCheckedChange={props.onCheckedChange}
        onSelect={props.onSelect}
        className={AxoBaseMenu.menuCheckboxItemStyles}
      >
        <AxoBaseMenu.ItemLeadingSlot>
          <AxoBaseMenu.ItemCheckPlaceholder>
            <DropdownMenu.ItemIndicator>
              <AxoBaseMenu.ItemCheck />
            </DropdownMenu.ItemIndicator>
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
      </DropdownMenu.CheckboxItem>
    );
  });

  CheckboxItem.displayName = `${Namespace}.CheckboxItem`;

  /**
   * Component: <AxoDropdownMenu.RadioGroup>
   * ---------------------------------------
   */

  export type RadioGroupProps = AxoBaseMenu.MenuRadioGroupProps;

  /**
   * Used to group multiple {@link AxoDropdownMenu.RadioItem}'s.
   */
  export const RadioGroup: FC<RadioGroupProps> = memo(props => {
    return (
      <DropdownMenu.RadioGroup
        value={props.value ?? undefined}
        onValueChange={props.onValueChange}
        className={AxoBaseMenu.menuRadioGroupStyles}
      >
        {props.children}
      </DropdownMenu.RadioGroup>
    );
  });

  RadioGroup.displayName = `${Namespace}.RadioGroup`;

  /**
   * Component: <AxoDropdownMenu.RadioItem>
   * --------------------------------------
   */

  export type RadioItemProps = AxoBaseMenu.MenuRadioItemProps;

  /**
   * An item that can be controlled and rendered like a radio.
   */
  export const RadioItem: FC<RadioItemProps> = memo(props => {
    return (
      <DropdownMenu.RadioItem
        value={props.value}
        className={AxoBaseMenu.menuRadioItemStyles}
        onSelect={props.onSelect}
      >
        <AxoBaseMenu.ItemLeadingSlot>
          <AxoBaseMenu.ItemCheckPlaceholder>
            <DropdownMenu.ItemIndicator>
              <AxoBaseMenu.ItemCheck />
            </DropdownMenu.ItemIndicator>
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
      </DropdownMenu.RadioItem>
    );
  });

  RadioItem.displayName = `${Namespace}.RadioItem`;

  /**
   * Component: <AxoDropdownMenu.Separator>
   * --------------------------------------
   */

  export type SeparatorProps = AxoBaseMenu.MenuSeparatorProps;

  /**
   * Used to visually separate items in the dropdown menu.
   */
  export const Separator: FC<SeparatorProps> = memo(() => {
    return (
      <DropdownMenu.Separator className={AxoBaseMenu.menuSeparatorStyles} />
    );
  });

  Separator.displayName = `${Namespace}.Separator`;

  /**
   * Component: <AxoDropdownMenu.ContentSeparator>
   */

  export const ContentSeparator: FC<SeparatorProps> = memo(() => {
    return (
      <DropdownMenu.Separator
        className={AxoBaseMenu.menuContentSeparatorStyles}
      />
    );
  });

  ContentSeparator.displayName = `${Namespace}.ContentSeparator`;

  /**
   * Component: <AxoDropdownMenu.Sub>
   * -------------------------------
   */

  export type SubProps = AxoBaseMenu.MenuSubProps;

  /**
   * Contains all the parts of a submenu.
   */
  export const Sub: FC<SubProps> = memo(props => {
    return <DropdownMenu.Sub>{props.children}</DropdownMenu.Sub>;
  });

  Sub.displayName = `${Namespace}.Sub`;

  /**
   * Component: <AxoDropdownMenu.SubTrigger>
   * ---------------------------------------
   */

  export type SubTriggerProps = AxoBaseMenu.MenuSubTriggerProps;

  /**
   * An item that opens a submenu. Must be rendered inside
   * {@link ContextMenu.Sub}.
   */
  export const SubTrigger: FC<SubTriggerProps> = memo(props => {
    return (
      <DropdownMenu.SubTrigger className={AxoBaseMenu.menuSubTriggerStyles}>
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
      </DropdownMenu.SubTrigger>
    );
  });

  SubTrigger.displayName = `${Namespace}.SubTrigger`;

  /**
   * Component: <AxoDropdownMenu.SubContent>
   * ---------------------------------------
   */

  export type SubContentProps = AxoBaseMenu.MenuSubContentProps;

  /**
   * The component that pops out when a submenu is open. Must be rendered
   * inside {@link AxoDropdownMenu.Sub}.
   */
  export const SubContent: FC<SubContentProps> = memo(props => {
    const { context, labelId, descriptionId } = useCreateAriaLabellingContext();
    return (
      <AriaLabellingProvider value={context}>
        <DropdownMenu.SubContent
          alignOffset={-6}
          collisionPadding={6}
          className={AxoBaseMenu.menuSubContentStyles}
          aria-labelledby={labelId}
          aria-describedby={descriptionId}
        >
          {props.children}
        </DropdownMenu.SubContent>
      </AriaLabellingProvider>
    );
  });

  SubContent.displayName = `${Namespace}.SubContent`;
}
