// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { memo } from 'react';
import type { FC, ReactNode } from 'react';
import { Select } from 'radix-ui';
import { AxoBaseMenu } from './_internal/AxoBaseMenu.dom.tsx';
import { AxoSymbol } from './AxoSymbol.dom.tsx';
import { tw } from './tw.dom.tsx';
import { ExperimentalAxoBadge } from './AxoBadge.dom.tsx';
import { AxoTheme } from './AxoTheme.dom.tsx';
import { variants } from './_internal/variants.dom.tsx';

/**
 * Displays a list of options for the user to pick from—triggered by a button.
 *
 * @example Anatomy
 * ```tsx
 * <AxoSelect.Root value={value} onValueChange={setValue}>
 *   <AxoSelect.Trigger placeholder="Choose…" />
 *   <AxoSelect.Content>
 *     <AxoSelect.Item value="a">
 *       <AxoSelect.ItemText>Option A</AxoSelect.ItemText>
 *     </AxoSelect.Item>
 *     <AxoSelect.Separator />
 *     <AxoSelect.Group>
 *       <AxoSelect.Label>Group</AxoSelect.Label>
 *       <AxoSelect.Item value="b">
 *         <AxoSelect.ItemText>Option B</AxoSelect.ItemText>
 *       </AxoSelect.Item>
 *     </AxoSelect.Group>
 *   </AxoSelect.Content>
 * </AxoSelect.Root>
 * ```
 *
 * @see {@link https://www.radix-ui.com/primitives/docs/components/select | Select - Radix Docs}
 * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/listbox/ | Button Pattern - ARIA Authoring Practices Guide}
 * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/ | Select-Only Combobox Example - ARIA Authoring Practices Guide}
 * @see {@link https://w3c.github.io/aria/#listbox | `listbox` role - WAI-ARIA 1.3}
 * @see {@link https://w3c.github.io/aria/#select | `select` role - WAI-ARIA 1.3}
 * @see {@link https://w3c.github.io/aria/#combobox | `combobox` role - WAI-ARIA 1.3}
 */
export namespace AxoSelect {
  /**
   * <AxoSelect.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    /**
     * The name of the select. Submitted with its owning form as part of a
     * name/value pair.
     */
    name?: string;
    /**
     * Associates the select with a `<form>` element by its id.
     */
    form?: string;
    /**
     * Browser autocomplete hint (e.g. `"country"`, `"language"`).
     */
    autoComplete?: string;
    /**
     * When `true`, prevents the user from interacting with select.
     */
    disabled?: boolean;
    /**
     * When `true`, indicates that the user must select a value before the
     * owning form can be submitted.
     */
    required?: boolean;
    /**
     * The controlled open state of the select.
     * Must be used in conjunction with `onOpenChange`.
     */
    open?: boolean;
    /**
     * Event handler called when the open state of the select changes.
     */
    onOpenChange?: (open: boolean) => void;
    /**
     * The controlled value of the select.
     * Should be used in conjunction with `onValueChange`.
     */
    value: string | null;
    /**
     * Event handler called when the value changes.
     */
    onValueChange: (value: string) => void;
    /**
     * Should be a `Trigger` and a `Content`.
     */
    children: ReactNode;
  }>;

  /**
   * Contains all the parts of a select.
   *
   * @example Notification sound picker
   * ```tsx
   * <AxoSelect.Root value={sound} onValueChange={setSound}>
   *   <AxoSelect.Trigger placeholder="Choose a sound" />
   *   <AxoSelect.Content>
   *     <AxoSelect.Item value="note"><AxoSelect.ItemText>Note</AxoSelect.ItemText></AxoSelect.Item>
   *     <AxoSelect.Item value="chord"><AxoSelect.ItemText>Chord</AxoSelect.ItemText></AxoSelect.Item>
   *     <AxoSelect.Item value="none"><AxoSelect.ItemText>None</AxoSelect.ItemText></AxoSelect.Item>
   *   </AxoSelect.Content>
   * </AxoSelect.Root>
   * ```
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

  Root.displayName = 'AxoSelect.Root';

  /**
   * <AxoSelect.Trigger>
   * --------------------------------------------------------------------------
   */

  /**
   * Visual style of the trigger button.
   * - `default`: Filled secondary background (default).
   * - `floating`: Elevated with a drop shadow.
   * - `borderless`: Transparent, shows a background only on hover.
   */
  export type TriggerVariant = 'default' | 'floating' | 'borderless';

  /**
   * Width of the trigger button.
   * - `fit`: Shrinks to fit the selected value (default).
   * - `full`: Stretches to fill the container.
   */
  export type TriggerWidth = 'fit' | 'full';

  /**
   * When the dropdown chevron is shown.
   * - `always`: Always visible (default).
   * - `on-hover`: Only visible on hover/focus.
   */
  export type TriggerChevron = 'always' | 'on-hover';

  const baseTriggerStyles = tw(
    'group relative inline-flex items-center',
    'rounded-full text-start type-body-medium font-medium text-label-primary',
    'disabled:text-label-disabled',
    'outline-none keyboard-mode:focus:outline-focus-ring',
    'forced-colors:border'
  );

  const TriggerVariants = variants<TriggerVariant>('AxoSelect.TriggerVariant', {
    default: tw(
      baseTriggerStyles,
      'bg-fill-secondary',
      'enabled:active:bg-fill-secondary-pressed'
    ),
    floating: tw(
      baseTriggerStyles,
      'bg-fill-floating',
      'shadow-elevation-1',
      'enabled:active:bg-fill-floating-pressed'
    ),
    borderless: tw(
      baseTriggerStyles,
      'bg-transparent',
      'enabled:hover:bg-fill-secondary',
      'enabled:active:bg-fill-secondary-pressed'
    ),
  });

  const TriggerWidths = variants<TriggerWidth>('AxoSelect.TriggerWidth', {
    fit: tw(),
    full: tw('w-full'),
  });

  const TriggerChevronStyles = variants<TriggerChevron>(
    'AxoSelect.TriggerChevron',
    {
      always: tw('ps-2 pe-2.5'),
      'on-hover': tw(
        'absolute inset-y-0 inset-e-0 w-9.5',
        'flex items-center justify-end pe-2',
        'opacity-0 group-enabled:group-hover:opacity-100 group-enabled:group-focus:opacity-100 group-data-[state=open]:opacity-100',
        'transition-opacity duration-150'
      ),
    }
  );

  const baseContentStyles = tw('flex min-w-0 flex-1');

  const TriggerChevronContentStyles = variants<TriggerChevron>(
    'AxoSelect.TriggerChevron',
    {
      always: tw(baseContentStyles, 'py-[5px] ps-3'),
      'on-hover': tw(
        baseContentStyles,
        'px-3 py-[5px]',
        '[--axo-select-trigger-mask-start:black]',
        'group-enabled:group-hover:[--axo-select-trigger-mask-start:transparent]',
        'group-enabled:group-focus:[--axo-select-trigger-mask-start:transparent]',
        'group-data-[state=open]:[--axo-select-trigger-mask-start:transparent]',
        'mask-[linear-gradient(to_left,var(--axo-select-trigger-mask-start)_19px,black_38px)]',
        'rtl:mask-[linear-gradient(to_right,var(--axo-select-trigger-mask-start)_19px,black_38px)]',
        'mask-no-repeat',
        'mask-right rtl:mask-left',
        '[transition-property:--axo-select-trigger-mask-start] duration-150'
      ),
    }
  );

  export type TriggerProps = Readonly<{
    /**
     * Visual style of the button. Defaults to `default`.
     */
    variant?: TriggerVariant;
    /**
     * Width of the button. Defaults to `fit`.
     */
    width?: TriggerWidth;
    /**
     * When to show the dropdown chevron. Defaults to `always`.
     */
    chevron?: TriggerChevron;
    /**
     * The content that will be rendered inside the `Trigger` when `value` is
     * `null`.
     */
    placeholder: string;
    /**
     * Custom rendering of the selected value inside the trigger.
     */
    children?: ReactNode;
  }>;

  /**
   * The button that toggles the select.
   * The {@link AxoSelect.Content} will position itself by aligning over the
   * trigger.
   */
  export const Trigger: FC<TriggerProps> = memo(props => {
    const variant = props.variant ?? 'default';
    const width = props.width ?? 'fit';
    const chevron = props.chevron ?? 'always';
    return (
      <Select.Trigger
        className={tw(TriggerVariants.get(variant), TriggerWidths.get(width))}
      >
        <div className={TriggerChevronContentStyles.get(chevron)}>
          <AxoBaseMenu.ItemText>
            <Select.Value placeholder={props.placeholder}>
              {props.children}
            </Select.Value>
          </AxoBaseMenu.ItemText>
        </div>
        <Select.Icon className={TriggerChevronStyles.get(chevron)}>
          <AxoSymbol.Icon symbol="chevron-down" size={14} label={null} />
        </Select.Icon>
      </Select.Trigger>
    );
  });

  Trigger.displayName = 'AxoSelect.Trigger';

  /**
   * <AxoSelect.Content>
   * --------------------------------------------------------------------------
   */

  /**
   * Positioning strategy for the dropdown popup.
   * - `item-aligned`: Overlays the list on the trigger, with the selected item
   *   aligned to the trigger position (default).
   * - `dropdown`: Drops down from below the trigger like a standard dropdown.
   */
  export type ContentPosition = 'item-aligned' | 'dropdown';

  type ContentPositionConfig = {
    position: Select.SelectContentProps['position'];
    alignOffset?: Select.SelectContentProps['alignOffset'];
    collisionPadding?: Select.SelectContentProps['collisionPadding'];
    sideOffset?: Select.SelectContentProps['sideOffset'];
  };

  const ContentPositions = variants<ContentPosition, ContentPositionConfig>(
    'AxoSelect.ContentPosition',
    {
      'item-aligned': {
        position: 'item-aligned',
      },
      dropdown: {
        position: 'popper',
        alignOffset: 0,
        collisionPadding: 6,
        sideOffset: 8,
      },
    }
  );

  export type ContentProps = Readonly<{
    /**
     * Positioning strategy for the popup. Defaults to `item-aligned`.
     */
    position?: ContentPosition;
    /**
     * Should be `Item`, `Group`, `Label`, and/or `Separator` elements.
     */
    children: ReactNode;
  }>;

  /**
   * The component that pops out when the select is open.
   * Uses a portal to render the content part into the `body`.
   */
  export const Content: FC<ContentProps> = memo(props => {
    const position = props.position ?? 'item-aligned';
    const positionConfig = ContentPositions.get(position);
    return (
      <Select.Portal>
        <AxoTheme.Inherit>
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
            <Select.Viewport
              className={AxoBaseMenu.selectContentViewportStyles}
            >
              <div className={AxoBaseMenu.menuGroupStyles}>
                {props.children}
              </div>
            </Select.Viewport>
            <Select.ScrollDownButton
              className={tw(
                'flex items-center justify-center p-1 text-label-primary'
              )}
            >
              <AxoSymbol.Icon symbol="chevron-down" size={14} label={null} />
            </Select.ScrollDownButton>
          </Select.Content>
        </AxoTheme.Inherit>
      </Select.Portal>
    );
  });

  Content.displayName = 'AxoSelect.Content';

  /**
   * <AxoSelect.Item>
   * --------------------------------------------------------------------------
   */

  export type ItemProps = Readonly<{
    /**
     * The value given as data when submitted with a name.
     */
    value: string;
    /**
     * When `true`, prevents the user from interacting with the item.
     */
    disabled?: boolean;
    /**
     * Optional text used for typeahead purposes.
     * By default the typeahead behavior will use the `.textContent` of the
     * `ItemText` part. Use this when the content is complex, or you have
     * non-textual content inside.
     */
    textValue?: string;
    /**
     * Optional leading icon. If one item has an icon, prefer to give all items
     * an icon.
     */
    symbol?: AxoSymbol.IconName;
    /**
     * Should be an `ItemText`, optionally followed by an
     * `ExperimentalItemBadge`.
     */
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

  Item.displayName = 'AxoSelect.Content';

  /**
   * <AxoSelect.ItemText>
   * --------------------------------------------------------------------------
   */

  export type ItemTextProps = Readonly<{
    /** The visible label for this item. Also shown inside the trigger when selected. */
    children: ReactNode;
  }>;

  /**
   * The textual part of the item. It should only contain the text you want to
   * see in the trigger when that item is selected. It should not be styled to
   * ensure correct positioning.
   */
  export const ItemText: FC<ItemTextProps> = memo(props => {
    return (
      <AxoBaseMenu.ItemText>
        <Select.ItemText>{props.children}</Select.ItemText>
      </AxoBaseMenu.ItemText>
    );
  });

  ItemText.displayName = 'AxoSelect.ItemText';

  /**
   * <AxoSelect.ItemBadge>
   * --------------------------------------------------------------------------
   */

  export type ExperimentalItemBadgeProps = Omit<
    ExperimentalAxoBadge.RootProps,
    'size'
  >;

  /**
   * A badge shown at the trailing edge of an item, typically for unread counts.
   */
  export const ExperimentalItemBadge = memo(
    (props: ExperimentalItemBadgeProps) => {
      return (
        <span className={tw('ms-[5px]')}>
          <ExperimentalAxoBadge.Root
            size="sm"
            value={props.value}
            max={props.max}
            maxDisplay={props.maxDisplay}
            label={props.label}
          />
        </span>
      );
    }
  );

  ExperimentalItemBadge.displayName = 'AxoSelect.ItemBadge';

  /**
   * <AxoSelect.Group>
   * --------------------------------------------------------------------------
   */

  export type GroupProps = Readonly<{
    /**
     * Should be a `Label` followed by one or more `Item` elements.
     */
    children: ReactNode;
  }>;

  /**
   * Group multiple items.
   * Use in conjunction with {@link AxoSelect.Label} to ensure good
   * accessibility via automatic labelling.
   */
  export const Group: FC<GroupProps> = memo(props => {
    return (
      <Select.Group className={AxoBaseMenu.selectGroupStyles}>
        {props.children}
      </Select.Group>
    );
  });

  Group.displayName = 'AxoSelect.Group';

  /**
   * <AxoSelect.Label>
   * --------------------------------------------------------------------------
   */

  export type LabelProps = Readonly<{
    /**
     * The text label for the group.
     */
    children: ReactNode;
  }>;

  /**
   * Render the label of a group. It won't be focusable using arrow keys.
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

  Label.displayName = 'AxoSelect.Label';

  /**
   * <AxoSelect.Separator>
   * --------------------------------------------------------------------------
   */

  /**
   * Visually separate items in the select.
   */
  export const Separator: FC = memo(() => {
    return <Select.Separator className={AxoBaseMenu.selectSeperatorStyles} />;
  });

  Separator.displayName = 'AxoSelect.Separator';
}
