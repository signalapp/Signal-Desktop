// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { memo, useMemo, useState } from 'react';
import type { CSSProperties, FC, ReactNode } from 'react';
import { tw } from './tw.dom.tsx';
import {
  createStrictContext,
  useStrictContext,
} from './_internal/StrictContext.dom.tsx';
import { AxoTooltip } from './AxoTooltip.dom.tsx';
import { variants } from './_internal/variants.dom.tsx';

/**
 * A scrollable container with configurable scrollbar styling, optional scroll
 * hints (edge indicators), and an optional gradient mask.
 *
 * @example Anatomy
 * ```tsx
 * <AxoScrollArea.Root scrollbarWidth="thin">
 *   <AxoScrollArea.Hint edge="top"/>
 *   <AxoScrollArea.Hint edge="bottom"/>
 *   <AxoScrollArea.Mask>
 *     <AxoScrollArea.Viewport>
 *       <AxoScrollArea.Content>
 *         ...
 *       </AxoScrollArea.Content>
 *     </AxoScrollArea.Viewport>
 *   </AxoScrollArea.Mask>
 * </AxoScrollArea.Root>
 * ```
 */
export namespace AxoScrollArea {
  /**
   * <AxoScrollArea.Root>
   * --------------------------------------------------------------------------
   */

  const AXO_SCROLL_AREA_TIMELINE_VERTICAL =
    '--axo-scroll-area-timeline-vertical';
  const AXO_SCROLL_AREA_TIMELINE_HORIZONTAL =
    '--axo-scroll-area-timeline-horizontal';

  /**
   * Which directions the area scrolls:
   * - `vertical`: Scrolls up/down (default).
   * - `horizontal`: Scrolls left/right.
   * - `both`: Scrolls in both axes.
   */
  export type Orientation = 'vertical' | 'horizontal' | 'both';

  /**
   * Width of the native scrollbar track:
   * - `wide`: Full-width system scrollbar.
   * - `thin`: Narrow overlay-style scrollbar.
   * - `none`: No scrollbar rendered (content still scrollable).
   */
  export type ScrollbarWidth = 'wide' | 'thin' | 'none';

  /**
   * Space reserved for the scrollbar to prevent layout shifts.
   * - `unstable`: No reserved space, layout shifts when scrollbar appears (default).
   * - `stable-one-edge`: Reserved space on one side only.
   * - `stable-both-edges`: Reserved space on both sides, keeps content centered.
   */

  export type ScrollbarGutter =
    | 'unstable'
    | 'stable-one-edge'
    | 'stable-both-edges';

  /**
   * Whether programmatic scrolling (e.g. `scrollIntoView`) is animated by default.
   * - `auto`: Instant scroll (default).
   * - `smooth`: Animated scroll.
   */
  export type ScrollBehavior = 'auto' | 'smooth';

  /**
   * When the scrollbar thumb is visible.
   * - `auto`: Always visible when content overflows (default).
   * - `as-needed`: Fades out when the area is not hovered or focused.
   */
  export type ScrollbarVisibility = 'auto' | 'as-needed';

  /** @internal */
  type RootContextText = Readonly<{
    orientation: Orientation;
    scrollbarWidth: ScrollbarWidth;
    scrollbarGutter: ScrollbarGutter;
    scrollbarVisibility: ScrollbarVisibility;
    scrollBehavior: ScrollBehavior;
  }>;

  /** @internal */
  const RootContext =
    createStrictContext<RootContextText>('AxoScrollArea.Root');

  export type RootProps = Readonly<{
    /**
     * Which axis(es) the area scrolls. Defaults to `vertical`.
     */
    orientation?: Orientation;
    /**
     * Constrains the width of the scroll area.
     */
    maxWidth?: number;
    /**
     * Constrains the height of the scroll area.
     * Use when the container is trying to fit the height of its children.
     */
    maxHeight?: number;
    /**
     * Width of the native scrollbar track.
     * Use when the container is trying to fit the width of its children.
     */
    scrollbarWidth: ScrollbarWidth;
    /**
     * Space reserved for the scrollbar. Defaults to `stable-both-edges`.
     */
    scrollbarGutter?: ScrollbarGutter;
    /**
     * When the scrollbar thumb is visible. Defaults to `auto`.
     */
    scrollbarVisibility?: ScrollbarVisibility;
    /**
     * Whether programmatic scrolling is animated by default.
     * Defaults to `auto`.
     */
    scrollBehavior?: ScrollBehavior;
    /**
     * Should be `Hint`, `Mask`, and/or `Viewport` elements.
     */
    children: ReactNode;
  }>;

  /**
   * Container that configures the scroll area. Provides scroll settings to
   * child `Viewport`, `Hint`, and `Mask` elements.
   *
   * @example Vertical scroll with thin scrollbar
   * ```tsx
   * <AxoScrollArea.Root scrollbarWidth="thin" scrollbarVisibility="as-needed" maxHeight={400}>
   *   <AxoScrollArea.Hint edge="top" />
   *   <AxoScrollArea.Hint edge="bottom" />
   *   <AxoScrollArea.Viewport>
   *     <AxoScrollArea.Content>{items}</AxoScrollArea.Content>
   *   </AxoScrollArea.Viewport>
   * </AxoScrollArea.Root>
   * ```
   */
  export const Root: FC<RootProps> = memo(props => {
    const {
      orientation = 'vertical',
      maxWidth,
      maxHeight,
      scrollbarWidth,
      scrollbarGutter = 'stable-both-edges',
      scrollbarVisibility = 'auto',
      scrollBehavior = 'auto',
    } = props;

    const context = useMemo((): RootContextText => {
      return {
        orientation,
        scrollbarWidth,
        scrollbarGutter,
        scrollbarVisibility,
        scrollBehavior,
      };
    }, [
      orientation,
      scrollbarWidth,
      scrollbarGutter,
      scrollbarVisibility,
      scrollBehavior,
    ]);

    const style = useMemo((): CSSProperties => {
      return {
        maxWidth,
        maxHeight,
        // `timeline-scope` allows elements outside of the scrollable element
        // to subscribe to the `scroll-timeline` below, which we need for <Hint>
        timelineScope: `${AXO_SCROLL_AREA_TIMELINE_VERTICAL}, ${AXO_SCROLL_AREA_TIMELINE_HORIZONTAL}`,
      };
    }, [maxWidth, maxHeight]);

    return (
      <RootContext.Provider value={context}>
        <div
          className={tw(
            'relative z-0',
            'flex size-full flex-col overflow-hidden',
            'rounded-[2px]',
            // Move the outline from the viewport to the parent
            // so it doesn't get cut off by <Mask>
            'keyboard-mode:has-[[data-axo-scroll-area-viewport]:focus]:outline-focus-ring'
          )}
          style={style}
        >
          {props.children}
        </div>
      </RootContext.Provider>
    );
  });

  Root.displayName = 'AxoScrollArea.Root';

  /**
   * <AxoScrollArea.Viewport>
   * --------------------------------------------------------------------------
   */

  const baseViewportStyles = tw(
    'relative z-0',
    'flex size-full flex-col',
    'overscroll-contain',
    // <Root> handles the focus ring
    'outline-none'
  );

  const ViewportScrollbarWidths = variants<ScrollbarWidth>(
    'AxoScrollArea.ScrollbarWidth',
    {
      wide: tw('scrollbar-width-auto'),
      thin: tw('scrollbar-width-thin'),
      none: tw('scrollbar-width-none'),
    }
  );

  const ViewportScrollbarGutters = variants<ScrollbarGutter>(
    'AxoScrollArea.ScrollbarGutter',
    {
      unstable: tw('scrollbar-gutter-auto'),
      'stable-one-edge': tw('scrollbar-gutter-stable'),
      'stable-both-edges': tw('scrollbar-gutter-stable'),
    }
  );

  const ViewportScrollbarVisibilities = variants<ScrollbarVisibility>(
    'AxoScrollArea.ScrollbarVisibility',
    {
      auto: tw(),
      'as-needed': tw(
        'transition-[scrollbar-color] duration-150 not-hover:not-focus-within:scrollbar-thumb-transparent'
      ),
    }
  );

  const ViewportScrollBehaviors = variants<ScrollBehavior>(
    'AxoScrollArea.ScrollBehavior',
    {
      auto: tw('scroll-auto'),
      smooth: tw('scroll-smooth'),
    }
  );

  const ScrollbarWidthGutterVertical = variants<ScrollbarWidth, string>(
    'AxoScrollArea.ScrollbarWidth',
    {
      wide: 'var(--axo-scrollbar-gutter-auto-vertical)',
      thin: 'var(--axo-scrollbar-gutter-thin-vertical)',
      none: '0px',
    }
  );

  const ScrollbarWidthGutterHorizontal = variants<ScrollbarWidth, string>(
    'AxoScrollArea.ScrollbarWidth',
    {
      wide: 'var(--axo-scrollbar-gutter-auto-horizontal)',
      thin: 'var(--axo-scrollbar-gutter-thin-horizontal)',
      none: '0px',
    }
  );

  export type ViewportProps = Readonly<{
    /**
     * Should be a `Content` element.
     */
    children: ReactNode;
  }>;

  /**
   * The scrollable element.
   * Must be placed inside `Root`, and should wrap a `Content`.
   */
  export const Viewport: FC<ViewportProps> = memo(props => {
    const {
      orientation,
      scrollbarWidth,
      scrollbarGutter,
      scrollbarVisibility,
      scrollBehavior,
    } = useStrictContext(RootContext);
    const [boundary, setBoundary] = useState<HTMLDivElement | null>(null);

    const style = useMemo((): CSSProperties => {
      const hasVerticalScrollbar = orientation !== 'horizontal';
      const hasHorizontalScrollbar = orientation !== 'vertical';

      // `scrollbar-gutter: stable both-edges` is broken in Chrome
      // See: https://issues.chromium.org/issues/40064879)
      // Instead we use padding to polyfill the feature
      let paddingTop: string | undefined;
      let paddingInlineStart: string | undefined;
      if (scrollbarGutter === 'stable-both-edges') {
        if (hasVerticalScrollbar) {
          paddingInlineStart = ScrollbarWidthGutterVertical.get(scrollbarWidth);
        }
        if (hasHorizontalScrollbar) {
          paddingTop = ScrollbarWidthGutterHorizontal.get(scrollbarWidth);
        }
      }

      // Enable overflow based on the orientation of the scroll area
      let overflowY: CSSProperties['overflowY'] = 'hidden';
      let overflowX: CSSProperties['overflowX'] = 'hidden';
      if (hasVerticalScrollbar) {
        overflowY = 'auto';
      }
      if (hasHorizontalScrollbar) {
        // `scrollbar-gutter: stable` only applies to the vertical scrollbar.
        // By using `overflow-x: scroll` we can emulate the same behavior
        const needsScrollbarGutterFix = scrollbarGutter !== 'unstable';
        overflowX = needsScrollbarGutterFix ? 'scroll' : 'auto';
      }

      return {
        overflowX,
        overflowY,
        paddingInlineStart,
        paddingTop,
        // Add `scroll-timeline` so that components like <Hint> and <Mask> can
        // animated based on the current scroll position
        scrollTimeline: `${AXO_SCROLL_AREA_TIMELINE_VERTICAL} y, ${AXO_SCROLL_AREA_TIMELINE_HORIZONTAL} x`,
      };
    }, [orientation, scrollbarWidth, scrollbarGutter]);

    return (
      <AxoTooltip.CollisionBoundary boundary={boundary}>
        <div
          ref={setBoundary}
          data-axo-scroll-area-viewport
          className={tw(
            baseViewportStyles,
            ViewportScrollbarWidths.get(scrollbarWidth),
            ViewportScrollbarGutters.get(scrollbarGutter),
            ViewportScrollbarVisibilities.get(scrollbarVisibility),
            ViewportScrollBehaviors.get(scrollBehavior)
          )}
          style={style}
        >
          {props.children}
        </div>
      </AxoTooltip.CollisionBoundary>
    );
  });

  Viewport.displayName = 'AxoScrollArea.Viewport';

  /**
   * <AxoScrollArea.Content>
   * --------------------------------------------------------------------------
   */

  export type ContentProps = Readonly<{
    /**
     * The scrollable content.
     */
    children: ReactNode;
  }>;

  const contentStyles = tw(
    //
    // CSS scrollers come in two forms:
    // 1. Parent determines the width/height of the scroller.
    // 2. Parent is sized based on the content of the scroller.
    //
    // For #2, we'll make the intrisic size fit to the content.
    'size-fit',
    // For #1, we'll fill the available space (this has no effect on #2).
    'min-h-full min-w-full',
    // Also support flex containers for #1
    'grow'
  );

  /**
   * Wrapper for the content inside `Viewport`.
   *
   * Sizes itself to fit content while also filling available space.
   */
  export const Content: FC<ContentProps> = memo(props => {
    return <div className={contentStyles}>{props.children}</div>;
  });

  Content.displayName = 'AxoScrollArea.Content';

  /**
   * <AxoScrollArea.Hint>
   * --------------------------------------------------------------------------
   */

  /**
   * Which edge of the scroll area the hint appears on.
   * - `top` / `bottom`: For vertically scrollable areas.
   * - `inline-start` / `inline-end`: For horizontally scrollable areas.
   */
  export type Edge = 'top' | 'bottom' | 'inline-start' | 'inline-end';

  const edgeStyles = tw(
    'absolute z-10',
    'opacity-0',
    'from-shadow-outline to-transparent dark:from-shadow-elevation-1',
    'animate-duration-1 [animation-name:axo-scroll-area-hint-reveal]',
    'forced-colors:bg-[ButtonBorder]'
  );

  // Need `animation-fill-mode` so we can customize the `animation-range`
  const edgeStartStyles = tw('animate-both');
  const edgeEndStyles = tw('animate-both animate-reverse');

  const edgeYStyles = tw('inset-x-0 h-0.5 forced-colors:h-px');
  const edgeXStyles = tw('inset-y-0 w-0.5 forced-colors:w-px');

  const HintEdges = variants<Edge>('AxoScrollArea.Edge', {
    top: tw(
      tw(edgeStyles, edgeYStyles, edgeStartStyles),
      'top-0 bg-linear-to-b'
    ),
    bottom: tw(
      tw(edgeStyles, edgeYStyles, edgeEndStyles),
      'bottom-0 bg-linear-to-t'
    ),
    'inline-start': tw(
      tw(edgeStyles, edgeXStyles, edgeStartStyles),
      'inset-s-0 bg-linear-to-r rtl:bg-linear-to-l'
    ),
    'inline-end': tw(
      tw(edgeStyles, edgeXStyles, edgeEndStyles),
      'inset-e-0 bg-linear-to-l rtl:bg-linear-to-r'
    ),
  });

  export type HintProps = Readonly<{
    /**
     * Scroll offset (px) at which the hint becomes fully visible.
     * Defaults to `1` (appears as soon as the user has scrolled 1px).
     */
    animationStartOffset?: number;
    /**
     * Scroll offset (px) from the end at which the hint starts to fade out.
     * Defaults to `20`.
     */
    animationEndOffset?: number;
    /**
     * Which edge of the scroll area to show the hint on.
     */
    edge: Edge;
  }>;

  /**
   * A thin gradient line that fades in at a scroll edge to signal there is
   * more content in that direction.
   *
   * Place inside `Root`, outside `Viewport`.
   *
   * @example
   * ```tsx
   * <AxoScrollArea.Hint edge="top" />
   * <AxoScrollArea.Hint edge="bottom" />
   * ```
   */
  export const Hint: FC<HintProps> = memo(props => {
    const { edge, animationStartOffset = 1, animationEndOffset = 20 } = props;
    const { orientation, scrollbarWidth } = useStrictContext(RootContext);

    const style = useMemo((): CSSProperties => {
      const isVerticalEdge = edge === 'top' || edge === 'bottom';
      const isStartEdge = edge === 'top' || edge === 'inline-start';

      return {
        insetInlineEnd:
          edge !== 'inline-start' && orientation === 'both'
            ? ScrollbarWidthGutterHorizontal.get(scrollbarWidth)
            : undefined,
        bottom:
          edge !== 'top' && orientation === 'both'
            ? ScrollbarWidthGutterVertical.get(scrollbarWidth)
            : undefined,
        animationTimeline: isVerticalEdge
          ? AXO_SCROLL_AREA_TIMELINE_VERTICAL
          : AXO_SCROLL_AREA_TIMELINE_HORIZONTAL,
        animationRangeStart: isStartEdge
          ? `${animationStartOffset}px`
          : `calc(100% - ${animationEndOffset}px)`,
        animationRangeEnd: isStartEdge
          ? `${animationEndOffset}px`
          : `calc(100% - ${animationStartOffset}px)`,
      };
    }, [
      scrollbarWidth,
      edge,
      orientation,
      animationStartOffset,
      animationEndOffset,
    ]);

    return <div className={HintEdges.get(edge)} style={style} />;
  });

  Hint.displayName = 'AxoScrollArea.Hint';

  /**
   * <AxoScrollArea.Mask>
   * --------------------------------------------------------------------------
   */

  export type MaskProps = Readonly<{
    /**
     * Fully-transparent (clipped) zone at the start edge in px.
     * Defaults to `0`.
     */
    maskStart?: number;
    /**
     * Gradient blend zone at each masked edge in px.
     * Defaults to `4`.
     */
    maskPadding?: number;
    /**
     * Fade-out zone at the scrollable end edge in px.
     * Defaults to `40`.
     */
    maskEnd?: number;
    /**
     * Scroll offset at which the start-edge mask begins animating in.
     * Defaults to `maskStart`.
     */
    animationStart?: number;
    /**
     * Blend zone used during animation.
     * Defaults to `maskPadding`.
     */
    animationPadding?: number;
    /**
     * Scroll offset at which the end-edge mask is fully visible.
     * Defaults to `maskEnd * 3`.
     */
    animationEnd?: number;
    /**
     * Should be a `Viewport` element.
     */
    children: ReactNode;
  }>;

  // These styles are very complex so they are in a separate CSS file
  const AXO_MASK_CLASS_NAME = 'axo-scroll-area-mask';

  /**
   * Applies a gradient fade mask at the scroll edges so content appears to
   * dissolve rather than abruptly clip. The mask animates in/out based on
   * scroll position. Wrap `Viewport` with this when a fade effect is needed.
   */
  export const Mask: FC<MaskProps> = memo(props => {
    const {
      maskStart = 0,
      maskPadding = 4,
      maskEnd = 40,
      animationStart = maskStart,
      animationPadding = maskPadding,
      animationEnd = maskEnd * 3,
    } = props;

    const { orientation, scrollbarWidth } = useStrictContext(RootContext);

    const style = useMemo(() => {
      const hasVerticalScrollbar = orientation !== 'horizontal';
      const hasHorizontalScrollbar = orientation !== 'vertical';

      const verticalGutter = hasVerticalScrollbar
        ? ScrollbarWidthGutterVertical.get(scrollbarWidth)
        : '0px';
      const horizontalGutter = hasHorizontalScrollbar
        ? ScrollbarWidthGutterHorizontal.get(scrollbarWidth)
        : '0px';

      return {
        '--axo-scroll-area-mask-scrollbar-gutter-vertical': verticalGutter,
        '--axo-scroll-area-mask-scrollbar-gutter-horizontal': horizontalGutter,
        '--axo-scroll-area-mask-start': `${maskStart}px`,
        '--axo-scroll-area-mask-padding': `${maskPadding}px`,
        '--axo-scroll-area-mask-end': `${maskEnd}px`,
        '--axo-scroll-area-animation-start': `${animationStart}px`,
        '--axo-scroll-area-animation-padding': `${animationPadding}px`,
        '--axo-scroll-area-animation-end': `${animationEnd}px`,
      } as CSSProperties;
    }, [
      scrollbarWidth,
      orientation,
      maskStart,
      maskPadding,
      maskEnd,
      animationStart,
      animationPadding,
      animationEnd,
    ]);

    return (
      <div
        className={tw(
          'flex size-full flex-col overflow-hidden',
          AXO_MASK_CLASS_NAME
        )}
        style={style}
      >
        {props.children}
      </div>
    );
  });

  Mask.displayName = 'AxoScrollArea.Mask';
}
