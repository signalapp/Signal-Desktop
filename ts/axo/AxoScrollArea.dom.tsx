// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { createContext, memo, useContext, useMemo } from 'react';
import type { CSSProperties, FC, ReactNode } from 'react';
import type { TailwindStyles } from './tw.dom.js';
import { tw } from './tw.dom.js';
import { assert } from './_internal/assert.dom.js';
import { getScrollbarGutters } from './_internal/scrollbars.dom.js';

const Namespace = 'AxoScrollArea';

const AXO_SCROLL_AREA_TIMELINE_VERTICAL = '--axo-scroll-area-timeline-vertical';
const AXO_SCROLL_AREA_TIMELINE_HORIZONTAL =
  '--axo-scroll-area-timeline-horizontal';

type AxoScrollAreaOrientation = 'vertical' | 'horizontal' | 'both';

const AxoScrollAreaOrientationContext =
  createContext<AxoScrollAreaOrientation | null>(null);

export function useAxoScrollAreaOrientation(): AxoScrollArea.Orientation {
  return assert(
    useContext(AxoScrollAreaOrientationContext),
    `Must be wrapped with <${Namespace}.Root>`
  );
}

/**
 * Displays a menu located at the pointer, triggered by a right click or a long press.
 *
 * Note: For menus that are triggered by a normal button press, you should use
 * `AxoDropdownMenu`.
 *
 * @example Anatomy
 * ```tsx
 * <AxoScrollArea.Root>
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
   * Context: ScrollAreaOrientation
   */

  export type Orientation = AxoScrollAreaOrientation;

  /**
   * Context: ScrollAreaConfig
   */

  export type ScrollbarWidth = 'wide' | 'thin' | 'none';

  export type ScrollbarGutter =
    | 'unstable'
    | 'stable-one-edge'
    | 'stable-both-edges';

  export type ScrollBehavior = 'auto' | 'smooth';

  type ScrollAreaConfig = Readonly<{
    scrollbarWidth: ScrollbarWidth;
    scrollbarGutter: ScrollbarGutter;
    scrollBehavior: ScrollBehavior;
  }>;

  const ScrollAreaConfigContext = createContext<ScrollAreaConfig | null>(null);

  // eslint-disable-next-line no-inner-declarations
  function useAxoScrollAreaConfig(): ScrollAreaConfig {
    return assert(
      useContext(ScrollAreaConfigContext),
      `Must be wrapped with <${Namespace}.Root>`
    );
  }

  /**
   * Component: <AxoScrollArea.Root>
   * -------------------------------
   */

  export type RootProps = Readonly<{
    orientation?: Orientation;
    maxWidth?: number;
    maxHeight?: number;
    scrollbarWidth: ScrollbarWidth;
    scrollbarGutter?: ScrollbarGutter;
    scrollBehavior?: ScrollBehavior;
    children: ReactNode;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    const {
      orientation = 'vertical',
      maxWidth,
      maxHeight,
      scrollbarWidth = 'thin',
      scrollbarGutter = 'stable-both-edges',
      scrollBehavior = 'auto',
    } = props;

    const config = useMemo((): ScrollAreaConfig => {
      return { scrollbarWidth, scrollbarGutter, scrollBehavior };
    }, [scrollbarWidth, scrollbarGutter, scrollBehavior]);

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
      <AxoScrollAreaOrientationContext.Provider value={orientation}>
        <ScrollAreaConfigContext.Provider value={config}>
          <div
            className={tw(
              'relative z-0',
              'flex size-full flex-col overflow-hidden',
              'rounded-[2px] outline-border-focused',
              // Move the outline from the viewport to the parent
              // so it doesn't get cut off by <Mask>
              '[:where(.keyboard-mode)_&:has([data-axo-scroll-area-viewport]:focus)]:outline-[2.5px]',
              'forced-colors:border forced-colors:border-[ButtonBorder]'
            )}
            style={style}
          >
            {props.children}
          </div>
        </ScrollAreaConfigContext.Provider>
      </AxoScrollAreaOrientationContext.Provider>
    );
  });

  Root.displayName = `${Namespace}.Root`;

  /**
   * Component: <AxoScrollArea.Viewport>
   * -----------------------------------
   */

  const baseViewportStyles = tw(
    'relative z-0',
    'flex size-full flex-col',
    'overscroll-contain',
    // <Root> handles the focus ring
    'outline-0'
  );

  // Note: Use "scroll" for `overflow-x` because scrollbar-gutter doesnt fix the space
  const ViewportOrientations: Record<Orientation, TailwindStyles> = {
    vertical: tw('overflow-x-hidden overflow-y-auto'),
    horizontal: tw('overflow-x-scroll overflow-y-hidden'),
    both: tw('overflow-x-scroll overflow-y-auto'),
  };

  const ViewportScrollbarWidths: Record<ScrollbarWidth, TailwindStyles> = {
    wide: tw('scrollbar-width-auto'),
    thin: tw('scrollbar-width-thin'),
    none: tw('scrollbar-width-none'),
  };

  const ViewportScrollbarGutters: Record<ScrollbarGutter, TailwindStyles> = {
    unstable: tw('scrollbar-gutter-auto'),
    'stable-one-edge': tw('scrollbar-gutter-stable'),
    'stable-both-edges': tw('scrollbar-gutter-stable'),
  };

  const ViewportScrollBehaviors: Record<ScrollBehavior, TailwindStyles> = {
    auto: tw('scroll-auto'),
    smooth: tw('scroll-smooth'),
  };

  export type ViewportProps = Readonly<{
    children: ReactNode;
  }>;

  export const Viewport: FC<ViewportProps> = memo(props => {
    const orientation = useAxoScrollAreaOrientation();
    const { scrollbarWidth, scrollbarGutter, scrollBehavior } =
      useAxoScrollAreaConfig();

    const style = useMemo((): CSSProperties => {
      const hasVerticalScrollbar = orientation !== 'horizontal';
      const hasHorizontalScrollbar = orientation !== 'vertical';

      // `scrollbar-gutter: stable both-edges` is broken in Chrome
      // See: https://issues.chromium.org/issues/40064879)
      // Instead we use padding to polyfill the feature
      let paddingTop: number | undefined;
      let paddingInlineStart: number | undefined;
      if (scrollbarGutter === 'stable-both-edges') {
        const scrollbarGutters = getScrollbarGutters(scrollbarWidth, 'custom');
        if (hasVerticalScrollbar) {
          paddingInlineStart = scrollbarGutters.vertical;
        }
        if (hasHorizontalScrollbar) {
          paddingTop = scrollbarGutters.horizontal;
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
      <div
        data-axo-scroll-area-viewport
        className={tw(
          baseViewportStyles,
          ViewportOrientations[orientation],
          ViewportScrollbarWidths[scrollbarWidth],
          ViewportScrollbarGutters[scrollbarGutter],
          ViewportScrollBehaviors[scrollBehavior]
        )}
        style={style}
      >
        {props.children}
      </div>
    );
  });

  Viewport.displayName = `${Namespace}.Viewport`;

  /**
   * Component: <AxoScrollArea.Content>
   * ----------------------------------
   */

  export type ContentProps = Readonly<{
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

  export const Content: FC<ContentProps> = memo(props => {
    return <div className={contentStyles}>{props.children}</div>;
  });

  Content.displayName = `${Namespace}.Content`;

  /**
   * Component: <AxoScrollArea.Hint>
   * -------------------------------
   */

  export type Edge = 'top' | 'bottom' | 'inline-start' | 'inline-end';

  const edgeStyles = tw(
    'absolute z-10',
    'opacity-0',
    'from-shadow-outline to-transparent dark:from-shadow-elevation-1',
    'animate-duration-1 [animation-name:axo-scroll-area-hint-reveal]'
  );

  // Need `animation-fill-mode` so we can customize the `animation-range`
  const edgeStartStyles = tw('animate-forwards');
  const edgeEndStyles = tw('animate-backwards animate-reverse');

  const edgeYStyles = tw('inset-x-0 h-0.5');
  const edgeXStyles = tw('inset-y-0 w-0.5');

  const HintEdges: Record<Edge, TailwindStyles> = {
    top: tw(
      edgeStyles,
      edgeYStyles,
      edgeStartStyles,
      'top-0',
      'bg-gradient-to-b'
    ),
    bottom: tw(
      edgeStyles,
      edgeYStyles,
      edgeEndStyles,
      'bottom-0',
      'bg-gradient-to-t'
    ),
    'inline-start': tw(
      edgeStyles,
      edgeXStyles,
      edgeStartStyles,
      'start-0',
      'bg-gradient-to-r rtl:bg-gradient-to-l'
    ),
    'inline-end': tw(
      edgeStyles,
      edgeXStyles,
      edgeEndStyles,
      'end-0',
      'bg-gradient-to-l rtl:bg-gradient-to-r'
    ),
  };

  export type HintProps = Readonly<{
    animationStartOffset?: number;
    animationEndOffset?: number;
    edge: Edge;
  }>;

  export const Hint: FC<HintProps> = memo(props => {
    const { edge, animationStartOffset = 1, animationEndOffset = 20 } = props;
    const orientation = useAxoScrollAreaOrientation();
    const { scrollbarWidth } = useAxoScrollAreaConfig();

    const style = useMemo((): CSSProperties => {
      const scrollbarGutters = getScrollbarGutters(scrollbarWidth, 'custom');

      const isVerticalEdge = edge === 'top' || edge === 'bottom';
      const isStartEdge = edge === 'top' || edge === 'inline-start';

      return {
        insetInlineEnd:
          edge !== 'inline-start' && orientation === 'both'
            ? scrollbarGutters.horizontal
            : undefined,
        bottom:
          edge !== 'top' && orientation === 'both'
            ? scrollbarGutters.vertical
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

    return <div className={HintEdges[edge]} style={style} />;
  });

  Hint.displayName = `${Namespace}.Hint`;

  /**
   * Component: <AxoScrollArea.Mask>
   * -------------------------------
   */

  export type MaskProps = Readonly<{
    maskStart?: number;
    maskPadding?: number;
    maskEnd?: number;

    animationStart?: number;
    animationPadding?: number;
    animationEnd?: number;

    children: ReactNode;
  }>;

  // These styles are very complex so they are in a separate CSS file
  const AXO_MASK_CLASS_NAME = 'axo-scroll-area-mask';

  export const Mask: FC<MaskProps> = memo(props => {
    const {
      maskStart = 0,
      maskPadding = 4,
      maskEnd = 40,
      animationStart = maskStart,
      animationPadding = maskPadding,
      animationEnd = maskEnd * 3,
    } = props;

    const orientation = useAxoScrollAreaOrientation();
    const { scrollbarWidth } = useAxoScrollAreaConfig();

    const style = useMemo(() => {
      const scrollbarGutters = getScrollbarGutters(scrollbarWidth, 'custom');

      const hasVerticalScrollbar = orientation !== 'horizontal';
      const hasHorizontalScrollbar = orientation !== 'vertical';

      const verticalGutter = hasVerticalScrollbar
        ? `${scrollbarGutters.vertical}px`
        : '0px';
      const horizontalGutter = hasHorizontalScrollbar
        ? `${scrollbarGutters.horizontal}px`
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
        className={tw('flex size-full flex-col', AXO_MASK_CLASS_NAME)}
        style={style}
      >
        {props.children}
      </div>
    );
  });

  Mask.displayName = `${Namespace}.Mask`;
}
