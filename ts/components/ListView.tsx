// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import classNames from 'classnames';
import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import type { Index, ListRowRenderer } from 'react-virtualized';
import { List } from 'react-virtualized';
import { ScrollBehavior } from '../types/Util';

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
  scrollBehavior = ScrollBehavior.Default,
}: Props): JSX.Element {
  const listRef = useRef<null | List>(null);

  useEffect(() => {
    const list = listRef.current;
    if (shouldRecomputeRowHeights && list) {
      list.recomputeRowHeights();
    }
  });

  const rowHeight = useCallback(
    (index: Index) => calculateRowHeight(index.index),
    [calculateRowHeight]
  );

  const style = useMemo(() => {
    return {
      // See `<Timeline>` for an explanation of this `any` cast.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      overflowY: scrollable ? ('overlay' as any) : 'hidden',
    };
  }, [scrollable]);

  return (
    <List
      className={classNames(
        'ListView',
        `ListView--scroll-behavior-${scrollBehavior}`,
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
