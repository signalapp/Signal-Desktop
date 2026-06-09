// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { DropdownMenu } from 'radix-ui';
import type { FC, ReactNode } from 'react';
import { computeAccessibleName } from 'dom-accessibility-api';
import { AxoSymbol } from './AxoSymbol.dom.tsx';
import { AxoBaseMenu } from './_internal/AxoBaseMenu.dom.tsx';
import { tw } from './tw.dom.tsx';
import {
  AriaLabellingProvider,
  useAriaLabellingContext,
  useCreateAriaLabellingContext,
} from './_internal/AriaLabellingContext.dom.tsx';
import { assert } from './_internal/assert.std.tsx';
import {
  getElementAriaRole,
  isAriaWidgetRole,
} from './_internal/ariaRoles.dom.tsx';
import {
  createStrictContext,
  useStrictContext,
} from './_internal/StrictContext.dom.tsx';
import { isTestOrMockEnvironment } from '../environment.std.ts';
import { AxoDragRegion } from './AxoDragRegion.dom.tsx';
import { AxoTheme } from './AxoTheme.dom.tsx';

const { useDisableDragRegions } = AxoDragRegion;

/**
 * Displays a menu to the user—such as a set of actions or functions—triggered
 * by a button.
 *
 * Note: For menus that are triggered by a right-click, you should use
 * `AxoContextMenu`.
 *
 * @example Anatomy
 * ```tsx
 * <AxoDropdownMenu.Root>
 *   <AxoDropdownMenu.Trigger>
 *     <AxoIconButton.Root variant="secondary" size="sm" symbol="more" label="More options" />
 *   </AxoDropdownMenu.Trigger>
 *   <AxoDropdownMenu.Content>
 *     <AxoDropdownMenu.Header label="Conversation" />
 *     <AxoDropdownMenu.Item symbol="bell-slash" onSelect={onMute}>Mute notifications</AxoDropdownMenu.Item>
 *     <AxoDropdownMenu.Separator />
 *     <AxoDropdownMenu.Item symbol="trash" onSelect={onDelete}>Delete</AxoDropdownMenu.Item>
 *   </AxoDropdownMenu.Content>
 * </AxoDropdownMenu.Root>
 * ```
 *
 * @see {@link https://www.radix-ui.com/primitives/docs/components/dropdown-menu | Dropdown Menu - Radix Docs}
 * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/ | Menu Button Pattern - ARIA Authoring Practices Guide}
 * @see {@link https://w3c.github.io/aria/#button | `button` role - WAI-ARIA 1.3}
 * @see {@link https://w3c.github.io/aria/#menu | `menu` role - WAI-ARIA 1.3}
 */
export namespace AxoDropdownMenu {
  /**
   * <AxoDropdownMenu.Root>
   * --------------------------------------------------------------------------
   */

  /**
   * The preferred alignment against the trigger.
   * May change when collisions occur.
   */
  export type Align = AxoBaseMenu.Align;

  /**
   * The preferred side of the trigger to render against when open.
   * Will be reversed when collisions occur.
   */
  export type Side = AxoBaseMenu.Side;

  /** @internal */
  type RootContextType = Readonly<{
    open: boolean;
  }>;

  /** @internal */
  const RootContext = createStrictContext<RootContextType>(
    'AxoDropdownMenu.RootContext'
  );

  export type RootProps = AxoBaseMenu.MenuRootProps &
    Readonly<{
      /**
       * The modality of the dropdown menu. When set to `true`, interaction
       * with outside elements will be disabled and only menu content will be
       * visible to screen readers.
       * Defaults to `true`.
       */
      modal?: boolean;
      /**
       * The controlled open state of the dropdown menu.
       * Must be used in conjunction with `onOpenChange`.
       */
      open?: boolean;
    }>;

  /**
   * Contains all the parts of a dropdown menu.
   *
   * @example Controlled open state
   * ```tsx
   * <AxoDropdownMenu.Root open={open} onOpenChange={setOpen}>
   *   <AxoDropdownMenu.Trigger>
   *     <AxoIconButton.Root variant="secondary" size="sm" symbol="more" label="More options" />
   *   </AxoDropdownMenu.Trigger>
   *   <AxoDropdownMenu.Content>
   *     <AxoDropdownMenu.Item symbol="bell-slash" onSelect={onMute}>Mute notifications</AxoDropdownMenu.Item>
   *   </AxoDropdownMenu.Content>
   * </AxoDropdownMenu.Root>
   * ```
   */
  export const Root: FC<RootProps> = memo(props => {
    const { modal, onOpenChange } = props;
    const [open, setOpen] = useState(false);

    if (typeof props.open === 'boolean' && open !== props.open) {
      setOpen(props.open);
    }

    const handleOpenChange = useCallback(
      (nextOpen: boolean) => {
        setOpen(nextOpen);
        onOpenChange?.(nextOpen);
      },
      [onOpenChange]
    );

    const context = useMemo((): RootContextType => {
      return { open };
    }, [open]);

    useDisableDragRegions(open);

    return (
      <RootContext.Provider value={context}>
        <DropdownMenu.Root
          modal={modal}
          open={open}
          onOpenChange={handleOpenChange}
        >
          {props.children}
        </DropdownMenu.Root>
      </RootContext.Provider>
    );
  });

  Root.displayName = 'AxoDropdownMenu.Root';

  /**
   * <AxoDropdownMenu.Trigger>
   * --------------------------------------------------------------------------
   */

  export type TriggerProps = AxoBaseMenu.MenuTriggerProps;

  /**
   * The button that toggles the dropdown menu.
   * By default, the {@link AxoDropdownMenu.Content} will position itself
   * against the trigger.
   */
  export const Trigger: FC<TriggerProps> = memo(props => {
    const context = useStrictContext(RootContext);
    const ref = useRef<HTMLButtonElement>(null);

    useEffect(() => {
      if (isTestOrMockEnvironment()) {
        assert(
          ref.current instanceof HTMLElement,
          '<AxoDropdownMenu.Trigger> child must forward ref'
        );
        assert(
          isAriaWidgetRole(getElementAriaRole(ref.current)),
          "<AxoDropdownMenu.Trigger> child must have a widget role like 'button'"
        );
        assert(
          computeAccessibleName(ref.current) !== '',
          '<AxoDropdownMenu.Trigger> child must have an accessible name'
        );
      }
    });

    return (
      <DropdownMenu.Trigger
        ref={ref}
        asChild
        disabled={props.disabled}
        data-axo-dropdownmenu-trigger
        data-axo-dropdownmenu-state={context.open ? 'open' : 'closed'}
      >
        {props.children}
      </DropdownMenu.Trigger>
    );
  });

  Trigger.displayName = 'AxoDropdownMenu.Trigger';

  /**
   * <AxoDropdownMenu.Content>
   * --------------------------------------------------------------------------
   */

  export type ContentProps = AxoBaseMenu.MenuContentProps;

  /**
   * The component that pops out when the dropdown menu is open.
   * Uses a portal to render the content part into the `body`.
   */
  export const Content: FC<ContentProps> = memo(props => {
    const { context, labelId, descriptionId } = useCreateAriaLabellingContext();
    const { open } = useStrictContext(RootContext);
    return (
      <AriaLabellingProvider value={context}>
        <DropdownMenu.Portal>
          <AxoTheme.Inherit>
            <DropdownMenu.Content
              sideOffset={4}
              align={props.align}
              side={props.side}
              collisionPadding={6}
              className={AxoBaseMenu.menuContentStyles}
              aria-labelledby={labelId}
              aria-describedby={descriptionId}
              onCloseAutoFocus={props.onCloseAutoFocus}
              inert={!open}
            >
              {props.children}
            </DropdownMenu.Content>
          </AxoTheme.Inherit>
        </DropdownMenu.Portal>
      </AriaLabellingProvider>
    );
  });

  Content.displayName = 'AxoDropdownMenu.Content';

  /**
   * <AxoDropdownMenu.CustomItem>
   * --------------------------------------------------------------------------
   */

  export type CustomItemProps = Pick<
    AxoBaseMenu.MenuItemProps,
    'disabled' | 'textValue' | 'keyboardShortcut' | 'onSelect'
  > &
    Readonly<{
      /**
       * Content of the "leading" slot, will be used to align with other
       * leading items.
       */
      leading?: ReactNode;
      /** The primary label text of the item. */
      text: ReactNode;
      /**
       * Content appended after the label in the content slot
       * (e.g. a count badge or status indicator).
       */
      suffix?: ReactNode;

      // TODO(jamie): trailing?: ReactNode;
      // TODO(jamie): prefix?: ReactNode;
    }>;

  /**
   * A menu item with a fully customizable leading slot and content slot.
   * Use when the built-in `Item` doesn't cover your layout needs.
   */
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

  CustomItem.displayName = 'AxoDropdownMenu.CustomItem';

  /**
   * <AxoDropdownMenu.Item>
   * --------------------------------------------------------------------------
   */

  export type ItemProps = AxoBaseMenu.MenuItemProps;

  /**
   * A single selectable row in the dropdown menu.
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

  Item.displayName = 'AxoDropdownMenu.Item';

  /**
   * <AxoDropdownMenu.Group>
   * --------------------------------------------------------------------------
   */

  export type GroupProps = AxoBaseMenu.MenuGroupProps;

  /**
   * Group multiple {@link AxoDropdownMenu.Item}'s.
   */
  export const Group: FC<GroupProps> = memo(props => {
    return (
      <DropdownMenu.Group className={AxoBaseMenu.menuGroupStyles}>
        {props.children}
      </DropdownMenu.Group>
    );
  });

  Group.displayName = 'AxoDropdownMenu.Group';

  /**
   * <AxoDropdownMenu.Label>
   * --------------------------------------------------------------------------
   */

  export type LabelProps = AxoBaseMenu.MenuLabelProps;

  /**
   * Render a label. It won't be focusable using arrow keys.
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

  Label.displayName = 'AxoDropdownMenu.Label';

  /**
   * <AxoDropdownMenu.Header>
   * --------------------------------------------------------------------------
   */

  export type HeaderProps = Readonly<{
    /** The primary title shown at the top of the content panel. */
    label: ReactNode;
    /** Optional secondary text below the title. */
    description?: ReactNode;
  }>;

  /**
   * A non-interactive header at the top of a `Content` or `SubContent` panel.
   * Automatically registers itself as the accessible label and description
   * for the containing menu.
   */
  export const Header: FC<HeaderProps> = memo(props => {
    const labelId = useId();
    const descriptionId = useId();

    const { labelRef, descriptionRef } = useAriaLabellingContext(
      'AxoDropdownMenu.Content/SubContent'
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

  Header.displayName = 'AxoDropdownMenu.Header';

  /**
   * <AxoDropdownMenu.CheckboxItem>
   * --------------------------------------------------------------------------
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
            <DropdownMenu.ItemIndicator
              className={tw('inline-flex items-center')}
            >
              <AxoBaseMenu.ItemCheck />
            </DropdownMenu.ItemIndicator>
          </AxoBaseMenu.ItemCheckPlaceholder>
        </AxoBaseMenu.ItemLeadingSlot>
        <AxoBaseMenu.ItemContentSlot>
          {props.symbol && (
            <span className={tw('me-2 inline-flex items-center')}>
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

  CheckboxItem.displayName = 'AxoDropdownMenu.CheckboxItem';

  /**
   * <AxoDropdownMenu.RadioGroup>
   * --------------------------------------------------------------------------
   */

  export type RadioGroupProps = AxoBaseMenu.MenuRadioGroupProps;

  /**
   * Group multiple {@link AxoDropdownMenu.RadioItem}'s.
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

  RadioGroup.displayName = 'AxoDropdownMenu.RadioGroup';

  /**
   * <AxoDropdownMenu.RadioItem>
   * --------------------------------------------------------------------------
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
        disabled={props.disabled}
        textValue={props.textValue}
        onSelect={props.onSelect}
      >
        <AxoBaseMenu.ItemLeadingSlot>
          <AxoBaseMenu.ItemCheckPlaceholder>
            <DropdownMenu.ItemIndicator
              className={tw('inline-flex items-center')}
            >
              <AxoBaseMenu.ItemCheck />
            </DropdownMenu.ItemIndicator>
          </AxoBaseMenu.ItemCheckPlaceholder>
        </AxoBaseMenu.ItemLeadingSlot>
        <AxoBaseMenu.ItemContentSlot>
          {props.symbol && (
            <span className={tw('me-2 inline-flex items-center')}>
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

  RadioItem.displayName = 'AxoDropdownMenu.RadioItem';

  /**
   * <AxoDropdownMenu.Separator>
   * --------------------------------------------------------------------------
   */

  /**
   * Visually separate items in the dropdown menu.
   */
  export const Separator: FC = memo(() => {
    return (
      <DropdownMenu.Separator className={AxoBaseMenu.menuSeparatorStyles} />
    );
  });

  Separator.displayName = 'AxoDropdownMenu.Separator';

  /**
   * <AxoDropdownMenu.ContentSeparator>
   * --------------------------------------------------------------------------
   */

  /**
   * Like `Separator`, but spans only the content column rather than the full
   * row.
   */
  export const ContentSeparator: FC = memo(() => {
    return (
      <DropdownMenu.Separator
        className={AxoBaseMenu.menuContentSeparatorStyles}
      />
    );
  });

  ContentSeparator.displayName = 'AxoDropdownMenu.ContentSeparator';

  /**
   * <AxoDropdownMenu.Sub>
   * --------------------------------------------------------------------------
   */

  export type SubProps = AxoBaseMenu.MenuSubProps;

  /**
   * Contains all the parts of a submenu.
   */
  export const Sub: FC<SubProps> = memo(props => {
    return <DropdownMenu.Sub>{props.children}</DropdownMenu.Sub>;
  });

  Sub.displayName = 'AxoDropdownMenu.Sub';

  /**
   * <AxoDropdownMenu.SubTrigger>
   * --------------------------------------------------------------------------
   */

  export type SubTriggerProps = AxoBaseMenu.MenuSubTriggerProps;

  /**
   * An item that opens a submenu. Must be rendered inside {@link AxoDropdownMenu.Sub}.
   */
  export const SubTrigger: FC<SubTriggerProps> = memo(props => {
    return (
      <DropdownMenu.SubTrigger
        disabled={props.disabled}
        textValue={props.textValue}
        className={AxoBaseMenu.menuSubTriggerStyles}
      >
        {props.symbol && (
          <AxoBaseMenu.ItemLeadingSlot>
            <AxoBaseMenu.ItemSymbol symbol={props.symbol} />
          </AxoBaseMenu.ItemLeadingSlot>
        )}
        <AxoBaseMenu.ItemContentSlot>
          <AxoBaseMenu.ItemText>{props.children}</AxoBaseMenu.ItemText>
          <span className={tw('ms-auto inline-flex items-center')}>
            <AxoSymbol.Icon size={14} symbol="chevron-[end]" label={null} />
          </span>
        </AxoBaseMenu.ItemContentSlot>
      </DropdownMenu.SubTrigger>
    );
  });

  SubTrigger.displayName = 'AxoDropdownMenu.SubTrigger';

  /**
   * <AxoDropdownMenu.SubContent>
   * --------------------------------------------------------------------------
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

  SubContent.displayName = 'AxoDropdownMenu.SubContent';
}
