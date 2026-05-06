// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ContextMenu } from 'radix-ui';
import type { FC, KeyboardEvent, MouseEvent } from 'react';
import { AxoSymbol } from './AxoSymbol.dom.tsx';
import { AxoBaseMenu } from './_internal/AxoBaseMenu.dom.tsx';
import { tw } from './tw.dom.tsx';
import { assert } from './_internal/assert.std.tsx';
import {
  createStrictContext,
  useStrictContext,
} from './_internal/StrictContext.dom.tsx';
import { AxoDragRegion } from './AxoDragRegion.dom.tsx';
import { AxoTheme } from './AxoTheme.dom.tsx';

const { useDisableDragRegions } = AxoDragRegion;

/**
 * Displays a menu at the pointer position, triggered by a right-click or the
 * platform context-menu keyboard shortcut.
 *
 * For menus triggered by a button press, use `AxoDropdownMenu` instead.
 *
 * @example Anatomy
 * ```tsx
 * <AxoContextMenu.Root>
 *   <AxoContextMenu.Trigger>
 *     <AxoContextMenu.Content>
 *       <AxoContextMenu.Label />
 *       <AxoContextMenu.Item />
 *       <AxoContextMenu.Group>
 *         <AxoContextMenu.Item />
 *       </AxoContextMenu.Group>
 *       <AxoContextMenu.CheckboxItem />
 *       <AxoContextMenu.RadioGroup>
 *         <AxoContextMenu.RadioItem />
 *       </AxoContextMenu.RadioGroup>
 *       <AxoContextMenu.Sub>
 *         <AxoContextMenu.SubTrigger />
 *         <AxoContextMenu.SubContent />
 *       </AxoContextMenu.Sub>
 *       <AxoContextMenu.Separator />
 *     </AxoContextMenu.Content>
 *   </AxoContextMenu.Trigger>
 * </AxoContextMenu.Root>
 * ```
 *
 * @see {@link https://www.radix-ui.com/primitives/docs/components/context-menu | Context Menu - Radix Docs}
 * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/ | Menu Button Pattern - ARIA Authoring Practices Guide}
 * @see {@link https://w3c.github.io/aria/#menu | `menu` role - WAI-ARIA 1.3}
 */
export namespace AxoContextMenu {
  /**
   * <AxoContextMenu.Root>
   * --------------------------------------------------------------------------
   */

  /** @internal */
  type RootContextType = Readonly<{
    open: boolean;
  }>;

  /** @internal */
  const RootContext = createStrictContext<RootContextType>(
    'AxoContextMenu.RootContext'
  );

  export type RootProps = AxoBaseMenu.MenuRootProps;

  /**
   * Contains all the parts of a context menu.
   *
   * @example Conversation list item with context menu
   * ```tsx
   * <AxoContextMenu.Root onOpenChange={onOpenChange}>
   *   <AxoContextMenu.Trigger>
   *     <ConversationListItem conversation={conversation} />
   *   </AxoContextMenu.Trigger>
   *   <AxoContextMenu.Content>
   *     <AxoContextMenu.Item symbol="message-badge" onSelect={onMarkUnread}>
   *       Mark unread
   *     </AxoContextMenu.Item>
   *     <AxoContextMenu.Sub>
   *       <AxoContextMenu.SubTrigger symbol="bell-slash">
   *         Mute notifications
   *       </AxoContextMenu.SubTrigger>
   *       <AxoContextMenu.SubContent>
   *         <AxoContextMenu.Item onSelect={() => onMute('1-hour')}>For 1 hour</AxoContextMenu.Item>
   *         <AxoContextMenu.Item onSelect={() => onMute('always')}>Always</AxoContextMenu.Item>
   *       </AxoContextMenu.SubContent>
   *     </AxoContextMenu.Sub>
   *     <AxoContextMenu.Separator />
   *     <AxoContextMenu.Item symbol="trash" onSelect={onDelete}>
   *       Delete conversation
   *     </AxoContextMenu.Item>
   *   </AxoContextMenu.Content>
   * </AxoContextMenu.Root>
   * ```
   */
  export const Root: FC<RootProps> = memo(props => {
    const { onOpenChange } = props;
    const [open, setOpen] = useState(false);

    const handleOpenChange = useCallback(
      (nextOpen: boolean) => {
        setOpen(nextOpen);
        onOpenChange?.(nextOpen);
      },
      [onOpenChange]
    );

    const context = useMemo(() => {
      return { open };
    }, [open]);

    useDisableDragRegions(open);

    return (
      <RootContext.Provider value={context}>
        <ContextMenu.Root onOpenChange={handleOpenChange}>
          {props.children}
        </ContextMenu.Root>
      </RootContext.Provider>
    );
  });

  Root.displayName = 'AxoContextMenu.Root';

  /**
   * <AxoContextMenu.Trigger>
   * --------------------------------------------------------------------------
   */

  type TriggerElementGetter = (event: KeyboardEvent) => Element;

  /** @internal */
  function useContextMenuTriggerKeyboardEventHandler(
    getTriggerElement: TriggerElementGetter
  ) {
    const getTriggerElementRef =
      useRef<TriggerElementGetter>(getTriggerElement);

    useEffect(() => {
      getTriggerElementRef.current = getTriggerElement;
    }, [getTriggerElement]);

    return useCallback(
      (event: KeyboardEvent) => {
        const isMacOS = window.platform === 'darwin';

        if (
          (isMacOS ? event.metaKey : !event.metaKey) &&
          (isMacOS ? !event.ctrlKey : event.ctrlKey) &&
          (isMacOS ? !event.shiftKey : event.shiftKey) &&
          !event.altKey &&
          (isMacOS ? event.key === 'F12' : event.key === 'F10')
        ) {
          event.preventDefault();
          event.stopPropagation();

          const trigger = getTriggerElement(event);

          const clientRect = trigger.getBoundingClientRect();

          trigger.dispatchEvent(
            new globalThis.MouseEvent('contextmenu', {
              bubbles: true,
              cancelable: true,
              clientX: clientRect.left,
              clientY: clientRect.bottom,
            })
          );
        }
      },
      [getTriggerElement]
    );
  }

  export type TriggerProps = AxoBaseMenu.MenuTriggerProps;

  /**
   * The area that opens the context menu.
   * Wrap it around the target you want the context menu to open from when
   * right-clicking (or using the relevant keyboard shortcuts).
   */
  export const Trigger: FC<TriggerProps> = memo(props => {
    const context = useStrictContext(RootContext);
    const [disableCurrentEvent, setDisableCurrentEvent] = useState(false);

    const handleContextMenuCapture = useCallback(
      (event: MouseEvent<HTMLElement>) => {
        const { target, currentTarget } = event;
        if (
          target instanceof HTMLElement &&
          target.closest('a[href], [role=link]') != null
        ) {
          setDisableCurrentEvent(true);
        }

        const selection = window.getSelection();
        if (
          selection != null &&
          !selection.isCollapsed &&
          selection.containsNode(currentTarget, true)
        ) {
          setDisableCurrentEvent(true);
        }
      },
      []
    );

    const handleContextMenu = useCallback(() => {
      setDisableCurrentEvent(false);
    }, []);

    const handleKeyDown = useContextMenuTriggerKeyboardEventHandler(event => {
      return event.currentTarget;
    });

    return (
      <ContextMenu.Trigger
        asChild
        onContextMenuCapture={handleContextMenuCapture}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
        disabled={disableCurrentEvent || props.disabled}
        data-axo-contextmenu-trigger
        data-axo-contextmenu-state={context.open ? 'open' : 'closed'}
      >
        {props.children}
      </ContextMenu.Trigger>
    );
  });

  Trigger.displayName = 'AxoContextMenu.Trigger';

  /**
   * useAxoContextMenuOutsideKeyboardTrigger()
   * --------------------------------------------------------------------------
   */

  /**
   * Returns a `onKeyDown` handler that fires the context-menu keyboard shortcut
   * on the `AxoContextMenu.Trigger` found inside `event.currentTarget`.
   *
   * Use this when the keyboard handler must live on a parent element that is
   * separate from the `Trigger` (e.g. a focusable row that contains a trigger
   * deeper in its tree). Attach the returned handler to the focusable element's
   * `onKeyDown`.
   *
   * @example Row-level keyboard handler
   * ```tsx
   * const handleKeyDown = AxoContextMenu.useAxoContextMenuOutsideKeyboardTrigger();
   *
   * <div role="row" tabIndex={0} onKeyDown={handleKeyDown}>
   *   <AxoContextMenu.Root>
   *     <AxoContextMenu.Trigger>{rowContent}</AxoContextMenu.Trigger>
   *     <AxoContextMenu.Content>...</AxoContextMenu.Content>
   *   </AxoContextMenu.Root>
   * </div>
   * ```
   */
  export function useAxoContextMenuOutsideKeyboardTrigger(): (
    event: KeyboardEvent
  ) => void {
    return useContextMenuTriggerKeyboardEventHandler(event => {
      return assert(
        event.currentTarget.querySelector('[data-axo-contextmenu-trigger]'),
        `Couldn't find <AxoContextMenu.Trigger> element, did you forget to pass all html props through?`
      );
    });
  }

  /**
   * <AxoContextMenu.Content>
   * --------------------------------------------------------------------------
   */

  export type ContentProps = AxoBaseMenu.MenuContentProps;

  /**
   * The component that pops out in an open context menu.
   * Uses a portal to render the content part into the `body`.
   */
  export const Content: FC<ContentProps> = memo(props => {
    const { open } = useStrictContext(RootContext);
    return (
      <ContextMenu.Portal>
        <AxoTheme.Inherit>
          <ContextMenu.Content
            className={AxoBaseMenu.menuContentStyles}
            alignOffset={-6}
            collisionPadding={6}
            onCloseAutoFocus={props.onCloseAutoFocus}
            inert={!open}
          >
            {props.children}
          </ContextMenu.Content>
        </AxoTheme.Inherit>
      </ContextMenu.Portal>
    );
  });

  Content.displayName = 'AxoContextMenu.Content';

  /**
   * <AxoContextMenu.Item>
   * --------------------------------------------------------------------------
   */

  export type ItemProps = AxoBaseMenu.MenuItemProps;

  /**
   * A single selectable item in the context menu.
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

  Item.displayName = 'AxoContextMenu.Item';

  /**
   * <AxoContextMenu.Group>
   * --------------------------------------------------------------------------
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

  Group.displayName = 'AxoContextMenu.Group';

  /**
   * <AxoContextMenu.Label>
   * --------------------------------------------------------------------------
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

  Label.displayName = 'AxoContextMenu.Label';

  /**
   * <AxoContextMenu.CheckboxItem>
   * --------------------------------------------------------------------------
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

  CheckboxItem.displayName = 'AxoContextMenu.CheckboxItem';

  /**
   * <AxoContextMenu.RadioGroup>
   * --------------------------------------------------------------------------
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

  RadioGroup.displayName = 'AxoContextMenu.RadioGroup';

  /**
   * <AxoContextMenu.RadioItem>
   * --------------------------------------------------------------------------
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

  RadioItem.displayName = 'AxoContextMenu.RadioItem';

  /**
   * <AxoContextMenu.Separator>
   * --------------------------------------------------------------------------
   */

  /**
   * Used to visually separate items in the context menu.
   */
  export const Separator: FC = memo(() => {
    return (
      <ContextMenu.Separator className={AxoBaseMenu.menuSeparatorStyles} />
    );
  });

  Separator.displayName = 'AxoContextMenu.Separator';

  /**
   * <AxoContextMenu.Sub>
   * --------------------------------------------------------------------------
   */

  export type SubProps = AxoBaseMenu.MenuSubProps;

  /**
   * Contains all the parts of a submenu.
   */
  export const Sub: FC<SubProps> = memo(props => {
    return <ContextMenu.Sub>{props.children}</ContextMenu.Sub>;
  });

  Sub.displayName = 'AxoContextMenu.Sub';

  /**
   * <AxoContextMenu.SubTrigger>
   * --------------------------------------------------------------------------
   */

  export type SubTriggerProps = AxoBaseMenu.MenuSubTriggerProps;

  /**
   * An item that opens a submenu. Must be rendered inside `AxoContextMenu.Sub`.
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

  SubTrigger.displayName = 'AxoContextMenu.SubTrigger';

  /**
   * <AxoContextMenu.SubContent>
   * --------------------------------------------------------------------------
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

  SubContent.displayName = 'AxoContextMenu.SubContent';
}
