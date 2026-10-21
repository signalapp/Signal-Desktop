// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { CSSProperties, FC, Ref, ReactNode } from 'react';
import { memo, useId, useMemo } from 'react';
import type { Transition } from 'motion/react';
import { motion, useReducedMotion } from 'motion/react';
import { tw } from '../tw.dom.tsx';
import { AxoBadge } from '../AxoBadge.dom.tsx';
import { createStrictContext, useStrictContext } from './StrictContext.dom.tsx';
import { variants } from './variants.dom.tsx';
import { forwardExtraPropsForRadix } from './props.dom.tsx';
import { AriaLabelled } from '../aria/AriaLabelled.dom.tsx';

/**
 * Used to share styles/animations for SegmentedControls, Toolbar ToggleGroups,
 * and Tabs.
 *
 * @example Anatomy
 * ```tsx
 * <ToggleGroup.Root asChild>
 *   <AxoBaseSegmentedControl.Root>
 *     <ToggleGroup.Item asChild>
 *       <AxoBaseSegmentedControl.Item/>
 *     </ToggleGroup.Item>
 *   </AxoBaseSegmentedControl.Root>
 * </ToggleGroup.Root>
 * ```
 */
export namespace ExperimentalAxoBaseSegmentedControl {
  /**
   * <AxoBaseSegmentedControl.Root>
   * --------------------------------------------------------------------------
   */

  /**
   * Visual style variant.
   */
  export type Variant = 'track' | 'no-track';

  /**
   * How the control sizes itself horizontally:
   * - `fit`: Shrinks to fit its content.
   * - `full`: Fills available width.
   */
  export type RootWidth = 'fit' | 'full';

  /**
   * How each item sizes itself within the control:
   * - `fit`: Items size to their content.
   * - `equal`: All items share equal width.
   */
  export type ItemWidth = 'fit' | 'equal';

  /**
   * The currently selected value(s).
   * A string for single-select, an array for multi-select, or `null` for nothing selected.
   */
  export type RootValue = string | ReadonlyArray<string> | null;

  /** @internal */
  type RootContextType = Readonly<{
    id: string;
    value: RootValue;
    variant: Variant;
    rootWidth: RootWidth;
    itemWidth: ItemWidth;
  }>;

  /** @internal */
  const RootContext = createStrictContext<RootContextType>(
    `AxoBaseSegmentedControl.Root`
  );

  const baseRootStyles = tw(
    'flex min-w-min flex-row items-center justify-items-stretch',
    'rounded-full',
    'forced-colors:border',
    'forced-colors:border-[ButtonBorder]'
  );

  const RootStyles = variants<Variant>(`AxoBaseSegmentedControl.Variant`, {
    track: tw(baseRootStyles, 'bg-primary'),
    'no-track': baseRootStyles,
  });

  const baseIndicatorStyles = tw(
    'pointer-events-none absolute inset-0 z-10 rounded-full',
    'forced-colors:bg-[SelectedItem]'
  );

  const IndicatorStyles = variants<Variant>(`AxoBaseSegmentedControl.Variant`, {
    track: tw(
      baseIndicatorStyles,
      'bg-control text-primary shadow-elevation-1'
    ),
    'no-track': tw(baseIndicatorStyles, 'bg-secondary text-primary'),
  });

  /**
   * <AxoBaseSegmentedControl.Root>
   * --------------------------------------------------------------------------
   */

  const RootWidths = variants<RootWidth>(`AxoBaseSegmentedControl.RootWidth`, {
    fit: tw('w-fit'),
    full: tw('w-full'),
  });

  export type RootProps = Readonly<{
    /** Ref to the underlying `<div>` element. */
    ref?: Ref<HTMLDivElement>;
    /** The currently selected value(s). */
    value: RootValue;
    /** Visual style variant. */
    variant: Variant;
    /** How the control sizes itself horizontally. */
    width: RootWidth;
    /** How each item sizes itself within the control. */
    itemWidth: ItemWidth;
    children: ReactNode;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    const { ref, value, variant, width, itemWidth, children, ...rest } = props;
    const id = useId();
    const context = useMemo(() => {
      return { id, value, variant, rootWidth: width, itemWidth };
    }, [id, value, variant, width, itemWidth]);
    return (
      <RootContext.Provider value={context}>
        <motion.div
          ref={ref}
          // We need the root to have `layout` so that the indicator is
          // positioned relative to it while animating, but we set the
          // transition to be instant
          layout
          initial={false}
          transition={{ duration: 0 }}
          className={tw(RootStyles.get(variant), RootWidths.get(width))}
          {...forwardExtraPropsForRadix(rest)}
        >
          {children}
        </motion.div>
      </RootContext.Provider>
    );
  });

  Root.displayName = 'AxoBaseSegmentedControl.Root';

  /**
   * <AxoBaseSegmentedControl.Item>
   * --------------------------------------------------------------------------
   */

  const ItemWidths = variants<ItemWidth>(`AxoBaseSegmentedControl.ItemWidth`, {
    fit: tw('min-w-0 shrink grow basis-auto'),
    equal: tw('flex-1'),
  });

  export const IndicatorTransition: Transition = {
    type: 'spring',
    stiffness: 422,
    damping: 37.3,
    mass: 1,
  };

  export type ItemProps = Readonly<{
    /** Ref to the underlying `<button>` element. */
    ref?: Ref<HTMLButtonElement>;
    /** The value this item represents. */
    value: string;
    children: ReactNode;
  }>;

  export const Item: FC<ItemProps> = memo(props => {
    const { ref, value, children, ...rest } = props;
    const context = useStrictContext(RootContext);
    const reducedMotion = useReducedMotion();

    const isSelected = useMemo(() => {
      if (context.value == null) {
        return false;
      }

      if (Array.isArray(context.value)) {
        return context.value.includes(value);
      }

      return context.value === value;
    }, [value, context.value]);

    return (
      <AriaLabelled.Root asChild>
        <button
          ref={ref}
          type="button"
          className={tw(
            'group',
            'relative flex min-w-0 items-center justify-center px-3 py-1.25',
            'cursor-pointer rounded-full type-body-medium font-medium text-primary',

            'forced-colors:bg-[ButtonFace] forced-colors:text-[ButtonText]',
            'forced-colors:data-[axo-contextmenu-state=open]:text-[HighlightText]',
            ItemWidths.get(context.itemWidth),
            isSelected &&
              tw(
                'focus-visible:outline-none',
                'forced-colors:text-[SelectedItemText]'
              ),
            !isSelected &&
              tw(
                'focus-visible:axo-focus-ring',
                'data-[axo-contextmenu-state=open]:bg-primary',

                'forced-colors:data-[axo-contextmenu-state=open]:bg-[Highlight]'
              )
          )}
          {...forwardExtraPropsForRadix(rest)}
        >
          {children}
          {isSelected && (
            <motion.span
              layoutId={`${context.id}.Indicator`}
              layout="x"
              initial={false}
              className={tw(
                IndicatorStyles.get(context.variant),
                'group-focus-visible:axo-focus-ring'
              )}
              transition={reducedMotion ? { duration: 0 } : IndicatorTransition}
              // Must be set via `style` so motion corrects it for scale
              // distortion while animating between items of different widths
              style={{ borderRadius: 14 }}
            />
          )}
        </button>
      </AriaLabelled.Root>
    );
  });

  Item.displayName = 'AxoBaseSegmentedControl.Item';

  /**
   * <AxoBaseSegmentedControl.ItemText>
   * --------------------------------------------------------------------------
   */

  /** CSS `max-width` value for the item label, used to prevent overflow. */
  export type ItemMaxWidth = CSSProperties['maxWidth'];

  export type ItemTextProps = Readonly<{
    /** Maximum width for the label before it truncates. */
    maxWidth?: ItemMaxWidth;
    children: ReactNode;
  }>;

  /** Truncated label text inside a segmented control item. */
  export const ItemText: FC<ItemTextProps> = memo(props => {
    return (
      <AriaLabelled.Label asChild>
        <span
          className={tw(
            'relative z-20 block truncate forced-color-adjust-none'
          )}
          style={{ maxWidth: props.maxWidth }}
        >
          {props.children}
        </span>
      </AriaLabelled.Label>
    );
  });

  ItemText.displayName = 'AxoBaseSegmentedControl.ItemText';

  /**
   * <AxoBaseSegmentedControl.ItemBadge>
   * --------------------------------------------------------------------------
   */

  export type ItemBadgeProps = Omit<AxoBadge.RootProps, 'size'>;

  /** A badge rendered to the right of the item label. */
  export const ItemBadge: FC<ItemBadgeProps> = memo((props: ItemBadgeProps) => {
    return (
      <AriaLabelled.Description asChild>
        <span className={tw('relative z-20 ms-[5px]')}>
          <AxoBadge.Root
            variant={props.variant}
            size="md"
            value={props.value}
            max={props.max}
            label={props.label}
          />
        </span>
      </AriaLabelled.Description>
    );
  });

  ItemBadge.displayName = 'AxoBaseSegmentedControl.ItemBadge';
}
