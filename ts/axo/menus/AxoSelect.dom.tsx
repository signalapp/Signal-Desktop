// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { memo, useId, useMemo } from 'react';
import type { FC, ReactNode, Ref } from 'react';
import { Select } from 'radix-ui';
import { AxoBaseMenu } from './_AxoBaseMenu.dom.tsx';
import { AxoBaseLayer } from '../_internal/AxoBaseLayer.dom.tsx';
import { AxoSymbol } from '../AxoSymbol.dom.tsx';
import { tw } from '../tw.dom.tsx';
import { AxoBadge } from '../AxoBadge.dom.tsx';
import { variants } from '../_internal/variants.dom.tsx';
import { css } from '../_internal/css.dom.tsx';
import { forwardExtraPropsForRadix } from '../_internal/props.dom.tsx';
import {
  createStrictContext,
  useStrictContext,
} from '../_internal/StrictContext.dom.tsx';

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
     * Label for the select as a whole.
     * Note: The label should be for all options, not the currently selected one.
     */
    label?: string | null;
    /**
     * Reference an element that labels the select.
     * Note: The label should be for all options, not the currently selected one.
     */
    labelledby?: string | null;
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
   * <AxoSelect.Root label="Notification sound" value={sound} onValueChange={setSound}>
   *   <AxoSelect.Trigger placeholder="Choose a sound" />
   *   <AxoSelect.Content>
   *     <AxoSelect.Item value="note"><AxoSelect.ItemText>Note</AxoSelect.ItemText></AxoSelect.Item>
   *     <AxoSelect.Item value="chord"><AxoSelect.ItemText>Chord</AxoSelect.ItemText></AxoSelect.Item>
   *     <AxoSelect.Item value="none"><AxoSelect.ItemText>None</AxoSelect.ItemText></AxoSelect.Item>
   *   </AxoSelect.Content>
   * </AxoSelect.Root>
   * ```
   */
  type RootContextType = Readonly<{
    /**
     * Rendered as `data-axo-select-id` on both the trigger and the listbox so
     * that they can be matched up even while the select is closed (Radix only
     * sets `aria-controls` on the trigger while it is open).
     */
    selectId: string;
    /**
     * Labels both the trigger and the listbox. Radix doesn't label the listbox
     * on its own.
     */
    label: string | null;
    labelledby: string | null;
  }>;

  const RootContext = createStrictContext<RootContextType>('AxoSelect.Root');

  /**
   * Radix shows the placeholder when the value is an empty string, and
   * `undefined` would make the select uncontrolled.
   */
  const RADIX_EMPTY_VALUE = '';

  export const Root: FC<RootProps> = memo(props => {
    const { label, labelledby } = props;
    const selectId = useId();
    const context = useMemo((): RootContextType => {
      return {
        selectId,
        label: label ?? null,
        labelledby: labelledby ?? null,
      };
    }, [selectId, label, labelledby]);
    return (
      <RootContext value={context}>
        <Select.Root
          name={props.name}
          form={props.form}
          autoComplete={props.autoComplete}
          disabled={props.disabled}
          required={props.required}
          open={props.open}
          onOpenChange={props.onOpenChange}
          value={props.value ?? RADIX_EMPTY_VALUE}
          onValueChange={props.onValueChange}
        >
          {props.children}
        </Select.Root>
      </RootContext>
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
   * - `elevated`: Elevated with a drop shadow.
   * - `implied`: Transparent, shows a background only on hover.
   */
  export type TriggerVariant = 'default' | 'elevated' | 'implied';

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

  const TriggerVariants = variants<TriggerVariant>('AxoSelect.TriggerVariant', {
    default: css('axo-select-trigger-default'),
    elevated: css('axo-select-trigger-elevated'),
    implied: css('axo-select-trigger-implied'),
  });

  const TriggerWidths = variants<TriggerWidth>('AxoSelect.TriggerWidth', {
    fit: css(),
    full: css('axo-select-trigger-full'),
  });

  const TriggerChevrons = variants<TriggerChevron>('AxoSelect.TriggerChevron', {
    always: css('axo-select-trigger-chevron-always'),
    'on-hover': css('axo-select-trigger-chevron-on-hover'),
  });

  export type TriggerProps = Readonly<{
    ref?: Ref<HTMLButtonElement>;
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
    placeholder: string | null;
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
    const {
      ref,
      variant: variantProp,
      width: widthProp,
      chevron: chevronProp,
      placeholder: placeholderProp,
      children,
      ...rest
    } = props;
    const placeholder = placeholderProp ?? '';
    const variant = variantProp ?? 'default';
    const width = widthProp ?? 'fit';
    const chevron = chevronProp ?? 'always';
    const { selectId, label, labelledby } = useStrictContext(RootContext);

    const placeholderOrEmpty = useMemo(() => {
      return placeholder === '' ? <>&nbsp;</> : placeholder;
    }, [placeholder]);

    return (
      <Select.Trigger
        ref={ref}
        data-axo-select-id={selectId}
        className={css(
          'axo-select-trigger',
          tw('group'),
          TriggerVariants.get(variant),
          TriggerWidths.get(width),
          TriggerChevrons.get(chevron)
        )}
        aria-label={label ?? undefined}
        aria-labelledby={labelledby ?? undefined}
        {...forwardExtraPropsForRadix(rest)}
      >
        <div className="axo-select-trigger-content">
          <span className="axo-select-trigger-text">
            <Select.Value placeholder={placeholderOrEmpty}>
              {children}
            </Select.Value>
          </span>
        </div>
        <Select.Icon className="axo-select-trigger-chevron">
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
    const { selectId, label, labelledby } = useStrictContext(RootContext);

    return (
      <Select.Portal>
        <AxoBaseLayer>
          <Select.Content
            data-axo-select-id={selectId}
            aria-label={label ?? undefined}
            aria-labelledby={labelledby ?? undefined}
            className="axo-select-content"
            position={positionConfig.position}
            alignOffset={positionConfig.alignOffset}
            collisionPadding={positionConfig.collisionPadding}
            sideOffset={positionConfig.sideOffset}
          >
            <Select.ScrollUpButton className="axo-select-scroll-button">
              <AxoSymbol.Icon symbol="chevron-up" size={14} label={null} />
            </Select.ScrollUpButton>
            <Select.Viewport className="axo-select-viewport">
              <div className="axo-select-viewport-group">{props.children}</div>
            </Select.Viewport>
            <Select.ScrollDownButton className="axo-select-scroll-button">
              <AxoSymbol.Icon symbol="chevron-down" size={14} label={null} />
            </Select.ScrollDownButton>
          </Select.Content>
        </AxoBaseLayer>
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
    symbol?: AxoSymbol.Name;
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
        className="axo-select-item"
      >
        <span className="axo-select-item-leading">
          <span className="axo-select-item-check-placeholder">
            <Select.ItemIndicator className="axo-select-item-indicator">
              <AxoBaseMenu.ItemCheck />
            </Select.ItemIndicator>
          </span>
        </span>
        <span className="axo-select-item-content">
          {props.symbol && (
            <span className="axo-select-item-symbol">
              <AxoBaseMenu.ItemSymbol symbol={props.symbol} />
            </span>
          )}
          {props.children}
        </span>
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
      <span className="axo-select-item-text">
        <Select.ItemText>{props.children}</Select.ItemText>
      </span>
    );
  });

  ItemText.displayName = 'AxoSelect.ItemText';

  /**
   * <AxoSelect.ItemBadge>
   * --------------------------------------------------------------------------
   */

  export type ItemBadgeProps = Omit<AxoBadge.RootProps, 'size'>;

  /**
   * A badge shown at the trailing edge of an item, typically for unread counts.
   */
  export const ItemBadge: FC<ItemBadgeProps> = memo((props: ItemBadgeProps) => {
    return (
      <span className="axo-select-item-badge">
        <AxoBadge.Root
          variant={props.variant}
          size="sm"
          value={props.value}
          max={props.max}
          label={props.label}
        />
      </span>
    );
  });

  ItemBadge.displayName = 'AxoSelect.ItemBadge';

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
      <Select.Group className="axo-select-group">{props.children}</Select.Group>
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
      <Select.Label className="axo-select-label">
        <span className="axo-select-item-content">
          <span className="axo-select-item-text">{props.children}</span>
        </span>
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
    return <Select.Separator className="axo-select-separator" />;
  });

  Separator.displayName = 'AxoSelect.Separator';
}
