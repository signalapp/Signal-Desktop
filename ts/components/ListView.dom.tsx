// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import classNames from 'classnames';
import lodash from 'lodash';
import {
  useRef,
  useCallback,
  useMemo,
  useLayoutEffect,
  type JSX,
  type CSSProperties,
} from 'react';
import type { Index, ListRowRenderer } from 'react-virtualized';
import { List } from 'react-virtualized';
import { ScrollBehavior } from '../types/Util.std.ts';

const { noop } = lodash;

const ScrollBehaviorClassNames: Record<ScrollBehavior, string> = {
  [ScrollBehavior.Default]: 'ListView--scroll-behavior-default',
  [ScrollBehavior.Hard]: 'ListView--scroll-behavior-hard',
};

type Props = {
  width: number;
  height: number;
  rowCount: number;
  calculateRowHeight: (index: number) => number;
  rowRenderer: ListRowRenderer;
  scrollToIndex?: number;
  scrollable?: boolean;
  className?: string;
  shouldRecomputeRowHeights?: boolean;
  resetShouldRecomputeRowHeights?: () => void;
  scrollBehavior?: ScrollBehavior;
};

/**
 * Thin wrapper around react-virtualized List. Simplified API and provides common
 * defaults.
 */
export function ListView({
  width,
  height,
  rowCount,
  calculateRowHeight,
  rowRenderer,
  scrollToIndex,
  className,
  scrollable = true,
  shouldRecomputeRowHeights = false,
  resetShouldRecomputeRowHeights = noop,
  scrollBehavior = ScrollBehavior.Default,
}: Props): JSX.Element {
  const listRef = useRef<null | List>(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (shouldRecomputeRowHeights) {
      list?.recomputeRowHeights();
      resetShouldRecomputeRowHeights();
    }
  }, [shouldRecomputeRowHeights, resetShouldRecomputeRowHeights]);

  const rowHeight = useCallback(
    (index: Index) => calculateRowHeight(index.index),
    [calculateRowHeight]
  );

  const style: CSSProperties = useMemo(() => {
    return {
      overflowY: scrollable ? 'auto' : 'hidden',
      direction: 'inherit',
      scrollbarGutter: 'stable',
    };
  }, [scrollable]);

  return (
    <List
      className={classNames(
        'ListView',
        ScrollBehaviorClassNames[scrollBehavior],
        className
      )}
      width={width}
      height={height}
      ref={listRef}
      rowCount={rowCount}
      rowHeight={rowHeight}
      rowRenderer={rowRenderer}
      scrollToIndex={scrollToIndex}
      style={style}
      tabIndex={-1}
    />
  );
}
