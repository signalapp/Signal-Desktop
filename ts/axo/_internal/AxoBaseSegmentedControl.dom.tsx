// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { CSSProperties, FC, Ref, ReactNode } from 'react';
import { memo, useId, useMemo } from 'react';
import type { Transition } from 'motion/react';
import { motion } from 'motion/react';
import { tw } from '../tw.dom.tsx';
import { ExperimentalAxoBadge } from '../AxoBadge.dom.tsx';
import { createStrictContext, useStrictContext } from './StrictContext.dom.tsx';
import { variants } from './variants.dom.tsx';

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
    track: tw(baseRootStyles, 'bg-fill-secondary'),
    'no-track': baseRootStyles,
  });

  const baseIndicatorStyles = tw(
    'pointer-events-none absolute inset-0 z-10 rounded-full',
    'forced-colors:bg-[SelectedItem]'
  );

  const IndicatorStyles = variants<Variant>(`AxoBaseSegmentedControl.Variant`, {
    track: tw(baseIndicatorStyles, 'bg-fill-primary', 'shadow-elevation-1'),
    'no-track': tw(baseIndicatorStyles, 'bg-fill-selected'),
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
    const { value, variant, width, itemWidth, children, ...rest } = props;
    const id = useId();
    const context = useMemo(() => {
      return { id, value, variant, rootWidth: width, itemWidth };
    }, [id, value, variant, width, itemWidth]);
    return (
      <RootContext.Provider value={context}>
        <div
          ref={props.ref}
          className={tw(RootStyles.get(variant), RootWidths.get(width))}
          {...rest}
        >
          {children}
        </div>
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

  const IndicatorTransition: Transition = {
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
    const { value, children, ...rest } = props;
    const context = useStrictContext(RootContext);

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
      <button
        ref={props.ref}
        type="button"
        className={tw(
          'relative flex min-w-0 items-center justify-center px-3 py-[5px]',
          'cursor-pointer rounded-full type-body-medium font-medium text-label-primary',
          'outline-border-focused not-forced-colors:outline-none not-forced-colors:keyboard-mode:focus:outline-focus-ring',
          'forced-colors:bg-[ButtonFace] forced-colors:text-[ButtonText]',
          'forced-colors:data-[axo-contextmenu-state=open]:text-[HighlightText]',
          ItemWidths.get(context.itemWidth),
          isSelected && tw('forced-colors:text-[SelectedItemText]'),
          !isSelected &&
            tw(
              'data-[axo-contextmenu-state=open]:bg-fill-secondary',
              'forced-colors:data-[axo-contextmenu-state=open]:bg-[Highlight]'
            )
        )}
        {...rest}
      >
        {children}
        {isSelected && (
          <motion.span
            layoutId={`${context.id}.Indicator`}
            className={IndicatorStyles.get(context.variant)}
            transition={IndicatorTransition}
            style={{ borderRadius: 14 }}
          />
        )}
      </button>
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
      <span
        className={tw('relative z-20 block truncate forced-color-adjust-none')}
        style={{ maxWidth: props.maxWidth }}
      >
        {props.children}
      </span>
    );
  });

  ItemText.displayName = 'AxoBaseSegmentedControl.ItemText';

  /**
   * <AxoBaseSegmentedControl.ItemBadge>
   * --------------------------------------------------------------------------
   */

  export type ExperimentalItemBadgeProps = Omit<
    ExperimentalAxoBadge.RootProps,
    'size'
  >;

  /** A badge rendered to the right of the item label. */
  export const ExperimentalItemBadge = memo(
    (props: ExperimentalItemBadgeProps) => {
      return (
        <span className={tw('relative z-20 ms-[5px]')}>
          <ExperimentalAxoBadge.Root
            size="md"
            value={props.value}
            max={props.max}
            maxDisplay={props.maxDisplay}
            label={props.label}
          />
        </span>
      );
    }
  );

  ExperimentalItemBadge.displayName = 'AxoBaseSegmentedControl.ItemBadge';
}
