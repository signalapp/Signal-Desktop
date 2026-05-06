// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC, ReactNode } from 'react';
import {
  createContext,
  memo,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { Tooltip, Direction } from 'radix-ui';
import { computeAccessibleName } from 'dom-accessibility-api';
import { tw } from './tw.dom.tsx';
import { assert } from './_internal/assert.std.tsx';
import {
  getElementAriaRole,
  isAriaWidgetRole,
} from './_internal/ariaRoles.dom.tsx';
import { isTestOrMockEnvironment } from '../environment.std.ts';
import { AxoTheme } from './AxoTheme.dom.tsx';
import { variants } from './_internal/variants.dom.tsx';

const { useDirection } = Direction;

/**
 * A popup that displays information related to an element when the element
 * receives keyboard focus or the mouse hovers over it.
 *
 * @example Anatomy
 * ```tsx
 * <AxoTooltip.Provider>
 *   <AxoTooltip.CollisionBoundary>
 *     <AxoTooltip.Root>
 *       <button/>
 *     </AxoTooltip.Root>
 *   </AxoTooltip.CollisionBoundary>
 * </AxoTooltip.Provider>
 * ```
 *
 * @see {@link https://www.radix-ui.com/primitives/docs/components/tooltip | Tooltip - Radix Docs}
 * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/ | Tooltip Pattern - ARIA Authoring Practices Guide}
 * @see {@link https://w3c.github.io/aria/#tooltip | `tooltip` role - WAI-ARIA 1.3}
 */
export namespace AxoTooltip {
  /**
   * The duration from when the mouse enters a tooltip trigger until the
   * tooltip opens.
   *
   * - auto: 700ms (default)
   * - none: 0ms
   * - TODO: Other durations?
   */
  export type Delay = 'auto' | 'none';

  const Delays = variants<Delay, number>('AxoTooltip.Delay', {
    auto: 700,
    none: 0,
  });

  /**
   * How much time the user has to enter another tooltip trigger without
   * incurring a delay again.
   * - auto: 300ms (default)
   * - never: 0ms
   */
  export type SkipDelay = 'auto' | 'never';

  const SkipDelays = variants<SkipDelay, number>('AxoTooltip.SkipDelay', {
    auto: 300,
    never: 0,
  });

  /**
   * <AxoTooltip.Provider>
   * --------------------------------------------------------------------------
   */

  export type ProviderProps = Readonly<{
    /** The duration from when the mouse enters a tooltip trigger until the tooltip opens. */
    delay?: Delay;
    /** How much time a user has to enter another trigger without incurring a delay again. */
    skipDelay?: SkipDelay;
    /** The subtree of components that can use tooltips. */
    children: ReactNode;
  }>;

  /** Wraps your app to provide global functionality to your tooltips. */
  export const Provider: FC<ProviderProps> = memo(props => {
    const { delay = 'auto', skipDelay = 'auto' } = props;
    return (
      <Tooltip.Provider
        delayDuration={Delays.get(delay)}
        skipDelayDuration={SkipDelays.get(skipDelay)}
      >
        {props.children}
      </Tooltip.Provider>
    );
  });

  Provider.displayName = 'AxoTooltip.Provider';

  /**
   * <AxoTooltip.CollisionBoundary>
   * --------------------------------------------------------------------------
   */

  const DEFAULT_COLLISION_PADDING = 8;

  /** @internal */
  type CollisionBoundaryType = Readonly<{
    elements: Array<Element | null>;
    padding: number;
  }>;

  /** @internal */
  const CollisionBoundaryContext = createContext<CollisionBoundaryType>({
    elements: [],
    padding: DEFAULT_COLLISION_PADDING,
  });

  export type CollisionBoundaryProps = Readonly<{
    /**
     * The element used as the collision boundary. By default this is the viewport,
     * though you can provide additional element(s) to be included in this check.
     */
    boundary: Element | null;
    /**
     * The distance in pixels from the boundary edges where collision detection
     * should occur. Accepts a number (same for all sides).
     */
    padding?: number;
    /** The subtree of components that share this collision boundary. */
    children: ReactNode;
  }>;

  /**
   * Constrains tooltip positioning to stay within a specific element,
   * overriding any parent boundary.
   * @example
   * ```tsx
   * const [boundary, setBoundary] = useState<HTMLElement | null>(null);
   * <AxoTooltip.CollisionBoundary boundary={boundary}>
   *   <div ref={setBoundary}>
   *     <AxoTooltip.Root label="Hello">
   *       <button />
   *     </AxoTooltip.Root>
   *   </div>
   * </AxoTooltip.CollisionBoundary>
   * ```
   */
  export const CollisionBoundary: FC<CollisionBoundaryProps> = memo(props => {
    const { boundary, padding } = props;
    const context = useContext(CollisionBoundaryContext);

    const value = useMemo((): CollisionBoundaryType => {
      return {
        elements: [...context.elements, boundary],
        padding: padding ?? DEFAULT_COLLISION_PADDING, // Always reset to default
      };
    }, [context, boundary, padding]);

    return (
      <CollisionBoundaryContext.Provider value={value}>
        {props.children}
      </CollisionBoundaryContext.Provider>
    );
  });

  CollisionBoundary.displayName = 'AxoTooltip.CollisionBoundary';

  /**
   * <AxoTooltip.Root>
   * --------------------------------------------------------------------------
   */

  /**
   * The preferred side of the trigger to render against when open.
   * Will be reversed when collisions occur.
   *
   * - top (default): Above the trigger, flips to bottom.
   * - bottom: Below the trigger, flips to top.
   * - inline-start: Left of trigger, or right in RTL language.
   * - inline-end: Right of trigger, or left in RTL language.
   */
  export type Side = 'top' | 'bottom' | 'inline-start' | 'inline-end';

  /**
   * The preferred alignment against the trigger.
   * - center (default): Try to align the tooltip as center as can fit within
   *   any collision boundaries.
   * - force-start/force-end: Force the tooltip and trigger to be aligned on
   *   their leading/trailing edges.
   */
  export type Align = 'center' | 'force-start' | 'force-end';

  type AlignValue = Tooltip.TooltipContentProps['align'];

  const Aligns = variants<Align, AlignValue>('AxoTooltip.Align', {
    center: 'center',
    'force-start': 'start',
    'force-end': 'end',
  });

  /**
   * The format used to display a timestamp alongside the tooltip label.
   *
   * TODO(jamie): Need to spec timestamp formats.
   */
  export type ExperimentalTimestampFormat = 'testing-only';

  /** @internal */
  type PhysicalDirection = 'top' | 'bottom' | 'left' | 'right';

  /** @internal */
  function generateTooltipArrowPath(): string {
    let path = '';
    path += 'M        0 0'; // start at top left
    path += 'Q  3 0,  5 2'; // left inner curve
    path += 'L        8 5'; // left edge
    path += 'Q  9 6, 10 6'; // left tip curve
    path += 'Q 11 6, 12 5'; // right tip curve
    path += 'L       15 2'; // right edge
    path += 'Q 17 0, 20 0'; // right inner curve, end at top right
    path += 'Z'; // close
    return path;
  }

  const TOOLTIP_ARROW_PATH = generateTooltipArrowPath();
  const TOOLTIP_ARROW_WIDTH = 20;
  const TOOLTIP_ARROW_HEIGHT = 6;

  export type RootConfigProps = Readonly<{
    /** Override the duration given to the `Provider` to customise the open delay for a specific tooltip. */
    delay?: Delay;
    /** The preferred side of the trigger to render against when open. Will be reversed when collisions occur. */
    side?: Side;
    /** The preferred alignment against the trigger. May change when collisions occur. */
    align?: Align;
    /** The primary text content of the tooltip. */
    label: ReactNode;
    /** An additional timestamp to display after the label. */
    experimentalTimestamp?: number | null;
    /** The timestamp format to use when a timestamp has been provided. */
    experimentalTimestampFormat?: ExperimentalTimestampFormat;
    /** An supplementary keyboard shortcut to display after the label for the button that the tooltip wraps. */
    keyboardShortcut?: string | null;
  }>;

  export type RootProps = RootConfigProps &
    Readonly<{
      /**
       * You may sometimes want to use [aria-hidden] when the tooltip is
       * repeating the same content as [aria-label] which would make it purely
       * a visual affordance.
       */
      tooltipRepeatsTriggerAccessibleName?: boolean;
      /** The trigger element that activates the tooltip on hover/focus. Must be a widget with an accessible name. */
      children: ReactNode;
      /** @private exported for stories only */
      __FORCE_OPEN?: boolean;
    }>;

  /**
   * Wraps a trigger element and shows a tooltip on hover/focus.
   *
   * The child must be a focusable widget with an accessible name that does
   * not duplicate the tooltip label.
   *
   * @example Tooltip repeats the label of the button to provide a visual label
   * ```tsx
   * <AxoTooltip.Root label="Send message" tooltipRepeatsTriggerAccessibleName>
   *   <button aria-label="Send message"/>
   * </AxoTooltip.Root>
   * ```
   *
   * @example Tooltip provides supplemental info to some button with an already visible label
   * ```tsx
   * <AxoTooltip.Root label="Already in a call">
   *   <button disabled>Join Call</button>
   * </AxoTooltip.Root>
   * ```
   */
  export const Root: FC<RootProps> = memo(props => {
    const {
      delay,
      side = 'top',
      align = 'center',
      keyboardShortcut,
      experimentalTimestamp,
    } = props;
    const direction = useDirection();
    const collisionBoundary = useContext(CollisionBoundaryContext);
    const triggerRef = useRef<HTMLButtonElement>(null);

    const physicalDirection = useMemo((): PhysicalDirection => {
      if (side === 'inline-start') {
        return direction === 'rtl' ? 'right' : 'left';
      }
      if (side === 'inline-end') {
        return direction === 'rtl' ? 'left' : 'right';
      }
      return side;
    }, [side, direction]);

    const hasArrow = useMemo(() => {
      return side === 'top' || side === 'bottom';
    }, [side]);

    const delayDuration = useMemo(() => {
      return delay != null ? Delays.get(delay) : undefined;
    }, [delay]);

    const formattedTimestamp = useMemo(() => {
      if (experimentalTimestamp == null) {
        return null;
      }
      const formatter = new Intl.DateTimeFormat('en', { timeStyle: 'short' });
      return formatter.format(experimentalTimestamp);
    }, [experimentalTimestamp]);

    const hasAccessory = useMemo(() => {
      return keyboardShortcut != null && formattedTimestamp != null;
    }, [keyboardShortcut, formattedTimestamp]);

    useEffect(() => {
      if (isTestOrMockEnvironment()) {
        assert(
          triggerRef.current instanceof HTMLElement,
          `<AxoTooltip.Root> child must forward ref`
        );
        assert(
          isAriaWidgetRole(getElementAriaRole(triggerRef.current)),
          `<AxoTooltip.Root> child must have a widget role like 'button'`
        );
        const triggerName = computeAccessibleName(triggerRef.current);
        assert(
          triggerName !== '',
          `<AxoTooltip.Root> child must have an accessible name`
        );

        if (props.tooltipRepeatsTriggerAccessibleName) {
          return;
        }

        assert(
          triggerName !== props.label,
          `<AxoTooltip.Root> label must not repeat child trigger's accessible name. ` +
            'Use the tooltipRepeatsTriggerAccessibleName prop if you would ' +
            'like to make the tooltip presentational only.'
        );
      }
    });

    return (
      <Tooltip.Root
        delayDuration={delayDuration}
        {...(props.__FORCE_OPEN === true ? { open: true } : undefined)}
      >
        <Tooltip.Trigger asChild ref={triggerRef}>
          {props.children}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <AxoTheme.Inherit>
            <Tooltip.Content
              side={physicalDirection}
              align={Aligns.get(align)}
              sideOffset={6}
              arrowPadding={14}
              collisionBoundary={collisionBoundary.elements}
              collisionPadding={collisionBoundary.padding}
              hideWhenDetached
              className={tw(
                'group flex items-baseline justify-center gap-2 overflow-hidden',
                'rounded-[14px] px-2.5 py-1.5 type-body-small select-none',
                'legacy-z-index-above-popup',
                'bg-elevated-background-quaternary text-label-primary-on-color',
                'shadow-elevation-3 shadow-no-outline',
                'min-w-12',
                hasAccessory ? 'max-w-[228px]' : 'max-w-[192px]'
              )}
            >
              {hasArrow && (
                <Tooltip.Arrow
                  asChild
                  width={TOOLTIP_ARROW_WIDTH}
                  height={TOOLTIP_ARROW_HEIGHT}
                >
                  <svg
                    className={tw('fill-elevated-background-quaternary')}
                    xmlns="http://www.w3.org/2000/svg"
                    width={TOOLTIP_ARROW_WIDTH}
                    height={TOOLTIP_ARROW_HEIGHT}
                    viewBox={`0 0 ${TOOLTIP_ARROW_WIDTH} ${TOOLTIP_ARROW_HEIGHT}`}
                  >
                    <path d={TOOLTIP_ARROW_PATH} />
                  </svg>
                </Tooltip.Arrow>
              )}
              <div
                aria-hidden={props.tooltipRepeatsTriggerAccessibleName}
                className={tw(
                  'line-clamp-4 max-h-full text-balance text-ellipsis hyphens-auto'
                )}
              >
                {props.label}
              </div>
              {keyboardShortcut != null && (
                <div
                  className={tw(
                    'type-body-small text-label-secondary-on-color'
                  )}
                >
                  {keyboardShortcut}
                </div>
              )}
              {formattedTimestamp != null && (
                <div
                  className={tw(
                    'type-caption whitespace-nowrap text-label-secondary-on-color'
                  )}
                >
                  {formattedTimestamp}
                </div>
              )}
            </Tooltip.Content>
          </AxoTheme.Inherit>
        </Tooltip.Portal>
      </Tooltip.Root>
    );
  });

  Root.displayName = 'AxoTooltip.Root';
}
