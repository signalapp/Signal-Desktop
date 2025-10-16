// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type {
  ButtonHTMLAttributes,
  CSSProperties,
  FC,
  ForwardedRef,
  HTMLAttributes,
  ReactNode,
} from 'react';
import React, {
  createContext,
  forwardRef,
  memo,
  useContext,
  useId,
  useMemo,
} from 'react';
import type { Transition } from 'framer-motion';
import { motion } from 'framer-motion';
import type { TailwindStyles } from '../tw.dom.js';
import { tw } from '../tw.dom.js';
import { ExperimentalAxoBadge } from '../AxoBadge.dom.js';

const Namespace = 'AxoBaseSegmentedControl';

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
  export type Variant = 'track' | 'no-track';
  export type RootWidth = 'fit' | 'full';
  export type ItemWidth = 'fit' | 'equal';

  export type RootValue = string | ReadonlyArray<string> | null;

  type RootContextType = Readonly<{
    id: string;
    value: RootValue;
    variant: Variant;
    rootWidth: RootWidth;
    itemWidth: ItemWidth;
  }>;

  const RootContext = createContext<RootContextType | null>(null);

  // eslint-disable-next-line no-inner-declarations
  function useRootContext(componentName: string): RootContextType {
    const context = useContext(RootContext);
    if (context == null) {
      throw new Error(
        `<${Namespace}.${componentName}> must be wrapped with <${Namespace}.Root>`
      );
    }
    return context;
  }

  type VariantConfig = {
    rootStyles: TailwindStyles;
    indicatorStyles: TailwindStyles;
  };

  const base: VariantConfig = {
    rootStyles: tw(
      'flex min-w-min flex-row items-center justify-items-stretch',
      'rounded-full',
      'forced-colors:border',
      'forced-colors:border-[ButtonBorder]'
    ),
    indicatorStyles: tw(
      'pointer-events-none absolute inset-0 z-10 rounded-full',
      'forced-colors:bg-[Highlight]'
    ),
  };

  const Variants: Record<Variant, VariantConfig> = {
    track: {
      rootStyles: tw(base.rootStyles, 'bg-fill-secondary'),
      indicatorStyles: tw(
        base.indicatorStyles,
        'bg-fill-primary',
        'shadow-elevation-1'
      ),
    },
    'no-track': {
      rootStyles: tw(base.rootStyles),
      indicatorStyles: tw(base.indicatorStyles, 'bg-fill-selected'),
    },
  };

  const IndicatorTransition: Transition = {
    type: 'spring',
    stiffness: 422,
    damping: 37.3,
    mass: 1,
  };

  /**
   * Component: <AxoBaseSegmentedControl.Root>
   * -----------------------------------------
   */

  const RootWidths: Record<RootWidth, TailwindStyles> = {
    fit: tw('w-fit'),
    full: tw('w-full'),
  };

  export type RootProps = HTMLAttributes<HTMLDivElement> &
    Readonly<{
      value: RootValue;
      variant: Variant;
      width: RootWidth;
      itemWidth: ItemWidth;
    }>;

  export const Root: FC<RootProps> = memo(
    forwardRef((props, ref: ForwardedRef<HTMLDivElement>) => {
      const { value, variant, width, itemWidth, ...rest } = props;
      const id = useId();
      const config = Variants[variant];
      const widthStyles = RootWidths[width];
      const context = useMemo(() => {
        return { id, value, variant, rootWidth: width, itemWidth };
      }, [id, value, variant, width, itemWidth]);
      return (
        <RootContext.Provider value={context}>
          <div
            ref={ref}
            {...rest}
            className={tw(config.rootStyles, widthStyles)}
          />
        </RootContext.Provider>
      );
    })
  );

  Root.displayName = `${Namespace}.Root`;

  /**
   * Component: <AxoBaseSegmentedControl.Item>
   * -----------------------------------------
   */

  const ItemWidths: Record<ItemWidth, TailwindStyles> = {
    fit: tw('min-w-0 shrink grow basis-auto'),
    equal: tw('flex-1'),
  };

  export type ItemProps = ButtonHTMLAttributes<HTMLButtonElement> &
    Readonly<{
      value: string;
    }>;

  export const Item: FC<ItemProps> = memo(
    forwardRef((props, ref: ForwardedRef<HTMLButtonElement>) => {
      const { value, ...rest } = props;

      const context = useRootContext('Item');
      const config = Variants[context.variant];
      const itemWidthStyles = ItemWidths[context.itemWidth];

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
          ref={ref}
          type="button"
          {...rest}
          className={tw(
            'group relative flex min-w-0 items-center justify-center px-3 py-[5px]',
            'cursor-pointer rounded-full type-body-medium font-medium text-label-primary',
            'outline-border-focused not-forced-colors:outline-0 not-forced-colors:focused:outline-[2.5px]',
            'forced-colors:bg-[ButtonFace] forced-colors:text-[ButtonText]',
            itemWidthStyles,
            isSelected && tw('forced-colors:text-[HighlightText]')
          )}
        >
          {props.children}
          {isSelected && (
            <motion.span
              layoutId={`${context.id}.Indicator`}
              layoutDependency={isSelected}
              className={config.indicatorStyles}
              transition={IndicatorTransition}
              style={{ borderRadius: 14 }}
            />
          )}
        </button>
      );
    })
  );

  Item.displayName = `${Namespace}.Item`;

  /**
   * Component: <AxoBaseSegmentedControl.ItemText>
   * ---------------------------------------------
   */

  export type ItemMaxWidth = CSSProperties['maxWidth'];

  export type ItemTextProps = Readonly<{
    maxWidth?: ItemMaxWidth;
    children: ReactNode;
  }>;

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

  ItemText.displayName = `${Namespace}.ItemText`;

  /**
   * Component: <AxoBaseSegmentedControl.ItemBadge>
   * ----------------------------------------------
   */

  export type ExperimentalItemBadgeProps = Omit<
    ExperimentalAxoBadge.RootProps,
    'size'
  >;

  export const ExperimentalItemBadge = memo(
    (props: ExperimentalItemBadgeProps) => {
      return (
        <span className={tw('relative z-20 ms-[5px]')}>
          <ExperimentalAxoBadge.Root
            size="md"
            value={props.value}
            max={props.max}
            maxDisplay={props.maxDisplay}
            aria-label={props['aria-label']}
          />
        </span>
      );
    }
  );

  ExperimentalItemBadge.displayName = `${Namespace}.ItemBadge`;
}
