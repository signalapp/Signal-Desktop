// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

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

const { noop } = lodash;

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
      className={className}
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
