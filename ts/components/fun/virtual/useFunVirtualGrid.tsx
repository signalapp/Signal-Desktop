// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Virtualizer } from '@tanstack/react-virtual';
import {
  useVirtualizer,
  type Range,
  type VirtualItem,
} from '@tanstack/react-virtual';
import { chunk, groupBy } from 'lodash';
import type { RefObject } from 'react';
import { useCallback, useMemo } from 'react';
import { strictAssert } from '../../../util/assert';
import { missingCaseError } from '../../../util/missingCaseError';

export type SectionKey = `section-${string}`;
export type HeaderKey = `header-${string}`;
export type RowKey = `row-${string}`;
export type CellKey = `cell-${string}`;

/**
 * Input sections with cells
 */

export type GridSectionNode = Readonly<{
  id: string;
  key: SectionKey;
  header: GridHeaderNode;
  cells: ReadonlyArray<GridCellNode>;
}>;

type GridHeaderNode = Readonly<{
  key: HeaderKey;
}>;

type GridCellNode = Readonly<{
  key: CellKey;
  value: string;
}>;

/**
 * Computed list
 */

type ListSectionMeta = Readonly<{
  sectionId: string;
  sectionKey: SectionKey;
  sectionIndex: number;
  sectionCount: number;
  colCount: number;
  rowCount: number;
}>;

type ListHeaderItem = Readonly<{
  sectionMeta: ListSectionMeta;
  kind: 'header';
  key: HeaderKey;
}>;

type ListRowItemCell = Readonly<{
  key: CellKey;
  value: string;
  rowIndex: number;
  colIndex: number;
}>;

type ListRowItem = Readonly<{
  sectionMeta: ListSectionMeta;
  kind: 'row';
  key: RowKey;
  rowIndex: number;
  cells: ReadonlyArray<ListRowItemCell>;
}>;

type ListItem = ListRowItem | ListHeaderItem;

type ListSection = Readonly<{
  id: string;
  key: SectionKey;
  headerIndex: number;
  firstRowIndex: number;
  lastRowIndex: number;
}>;

type List = Readonly<{
  count: number;
  listSections: ReadonlyArray<ListSection>;
  listItems: ReadonlyArray<ListItem>;
}>;

function buildList(
  sections: ReadonlyArray<GridSectionNode>,
  columns: number
): List {
  const listSections: Array<ListSection> = [];
  const listItems: Array<ListItem> = [];

  sections
    .filter(section => {
      return section.cells.length > 0;
    })
    .forEach((section, sectionIndex) => {
      const headerIndex = listItems.length;
      const cellChunks = chunk(section.cells, columns);
      const sectionMeta: ListSectionMeta = {
        sectionId: section.id,
        sectionKey: section.key,
        sectionIndex,
        sectionCount: sections.length,
        rowCount: cellChunks.length,
        colCount: columns,
      };

      listItems.push({
        sectionMeta,
        kind: 'header',
        key: section.header.key,
      });

      const firstRowIndex = listItems.length;

      cellChunks.forEach((itemChunk, rowIndex) => {
        listItems.push({
          sectionMeta,
          kind: 'row',
          key: `row-${section.key}-${rowIndex}`,
          rowIndex,
          cells: itemChunk.map((cell, colIndex) => {
            return {
              key: cell.key,
              value: cell.value,
              rowIndex,
              colIndex,
            };
          }),
        });
      });

      const lastRowIndex = listItems.length - 1;

      listSections.push({
        id: section.id,
        key: section.key,
        headerIndex,
        firstRowIndex,
        lastRowIndex,
      });
    });

  return { count: listItems.length, listSections, listItems };
}

/**
 * Final layout nodes
 */

type SectionLayoutNode = Readonly<{
  key: SectionKey;
  id: string;
  header: HeaderLayoutNode;
  sectionIndex: number;
  sectionOffset: number;
  sectionSize: number;
  rowCount: number;
  colCount: number;
  rowGroup: RowGroupLayoutNode;
}>;

type HeaderLayoutNode = Readonly<{
  key: HeaderKey;
  item: VirtualItem;
  headerOffset: number;
  headerSize: number;
}>;

type RowGroupLayoutNode = Readonly<{
  rowGroupOffset: number;
  rowGroupSize: number;
  rows: ReadonlyArray<RowLayoutNode>;
}>;

type RowLayoutNode = Readonly<{
  key: RowKey;
  item: VirtualItem;
  rowIndex: number;
  rowOffset: number;
  rowSize: number;
  cells: ReadonlyArray<CellLayoutNode>;
}>;

export type CellLayoutNode = Readonly<{
  key: CellKey;
  value: string;
  rowIndex: number;
  colIndex: number;
}>;

export type Layout = Readonly<{
  totalHeight: number;
  sections: ReadonlyArray<SectionLayoutNode>;
}>;

function buildLayout(
  list: List,
  virtualItems: ReadonlyArray<VirtualItem>,
  totalHeight: number
): Layout {
  const groups = groupBy(virtualItems, virtualItem => {
    return list.listItems[virtualItem.index].sectionMeta.sectionKey;
  });

  const sections = Object.keys(groups).map((sectionKey): SectionLayoutNode => {
    const [headerVirtualItem, ...rowVirtualItems] = groups[sectionKey];
    const headerListItem = list.listItems.at(headerVirtualItem.index);

    strictAssert(
      headerListItem != null && headerListItem.kind === 'header',
      // Hello, this error is most likely an issue with listRangeExtractor
      // it needs to always include the header index and have all of the indexes
      // sorted from lowest to highest
      'Expected header in first position in group'
    );

    const { sectionId, sectionIndex, rowCount, colCount } =
      headerListItem.sectionMeta;

    const lastVisibleRow = rowVirtualItems.at(-1);

    const headerStart = headerVirtualItem.start;
    const headerSize = headerVirtualItem.size;

    const rowGroupStart = headerStart + headerSize;
    const rowGroupEnd = lastVisibleRow?.end ?? rowGroupStart;
    const rowGroupSize = rowGroupEnd - rowGroupStart;

    const sectionStart = headerStart;
    const sectionSize = headerSize + rowGroupSize;

    const sectionOffset = sectionStart;
    const headerOffset = headerStart - sectionOffset;
    const rowGroupOffset = rowGroupStart - sectionOffset;

    return {
      id: sectionId,
      key: sectionKey as SectionKey,
      sectionIndex,
      sectionOffset,
      sectionSize,
      rowCount,
      colCount,
      header: {
        key: headerListItem.key,
        item: headerVirtualItem,
        headerOffset,
        headerSize,
      },
      rowGroup: {
        rowGroupOffset,
        rowGroupSize,
        rows: rowVirtualItems.map((rowVirtualItem): RowLayoutNode => {
          const rowListItem = list.listItems.at(rowVirtualItem.index);

          strictAssert(
            rowListItem != null && rowListItem.kind === 'row',
            `Expected row at index ${rowVirtualItem.index}`
          );

          const rowOffset = rowVirtualItem.start - rowGroupStart;

          return {
            key: rowListItem.key,
            item: rowVirtualItem,
            rowIndex: rowListItem.rowIndex,
            rowOffset,
            rowSize: rowVirtualItem.size,
            cells: rowListItem.cells.map(cell => {
              return {
                key: cell.key,
                value: cell.value,
                rowIndex: cell.rowIndex,
                colIndex: cell.colIndex,
              };
            }),
          };
        }),
      },
    };
  });

  return { totalHeight, sections };
}

/**
 * Component
 */

export type Cell = Readonly<{
  sectionKey: SectionKey;
  rowKey: RowKey;
  cellKey: CellKey;

  sectionIndex: number;
  rowIndex: number;
  colIndex: number;

  item: VirtualItem;
}>;

export type FunVirtualGridOptions = Readonly<{
  scrollerRef: RefObject<HTMLDivElement>;
  sections: ReadonlyArray<GridSectionNode>;
  columns: number;
  overscan: number;
  sectionGap: number;
  headerSize: number;
  rowSize: number;
  focusedCellKey: CellKey | null;
}>;

type Result = [
  virtualizer: Virtualizer<HTMLDivElement, HTMLDivElement>,
  layout: Layout,
];

export function useFunVirtualGrid({
  scrollerRef,
  sections,
  columns,
  overscan,
  sectionGap,
  headerSize,
  rowSize,
  focusedCellKey,
}: FunVirtualGridOptions): Result {
  const list = useMemo(() => {
    return buildList(sections, columns);
  }, [sections, columns]);

  const focusedRowIndex = useMemo(() => {
    if (focusedCellKey == null) {
      return null;
    }

    const foundIndex = list.listItems.findIndex(listItem => {
      return (
        listItem.kind === 'row' &&
        listItem.cells.some(cell => {
          return cell.key === focusedCellKey;
        })
      );
    });

    strictAssert(
      foundIndex >= 0,
      `Missing row item for cell key ${focusedCellKey}`
    );

    return foundIndex;
  }, [list, focusedCellKey]);

  const getScrollElement = useCallback(() => {
    const element = scrollerRef.current;
    strictAssert(element, 'Expected scrollerRef.current to be defined');
    return element;
  }, [scrollerRef]);

  const estimateSize = useCallback(
    (index: number) => {
      const listItem = list.listItems.at(index);
      strictAssert(listItem != null, `Expected list item at index ${index}`);

      if (listItem.kind === 'header') {
        return headerSize;
      }

      if (listItem.kind === 'row') {
        const isLastSection =
          listItem.sectionMeta.sectionIndex ===
          listItem.sectionMeta.sectionCount - 1;
        const isLastRow =
          listItem.rowIndex === listItem.sectionMeta.rowCount - 1;
        if (isLastRow && !isLastSection) {
          return rowSize + sectionGap;
        }
        return rowSize;
      }

      throw missingCaseError(listItem);
    },
    [list, sectionGap, headerSize, rowSize]
  );

  const rangeExtractor = useCallback(
    (range: Range) => {
      const indexes = new Set<number>();
      const start = Math.max(range.startIndex - range.overscan, 0);
      const end = Math.min(range.endIndex + range.overscan, range.count - 1);

      // Always include the very first row as a jump point for keyboard navigation
      const firstRowIndex = list.listSections.at(0)?.firstRowIndex;
      if (firstRowIndex != null) {
        indexes.add(firstRowIndex);
      }

      // Always include the very last row as a jump point for keyboard navigation
      const lastRowIndex = list.listSections.at(-1)?.lastRowIndex;
      if (lastRowIndex != null) {
        indexes.add(lastRowIndex);
      }

      for (const section of list.listSections) {
        // Always include the header
        indexes.add(section.headerIndex);

        if (section.firstRowIndex > end || section.lastRowIndex < start) {
          continue;
        }

        const sectionStart = Math.max(start, section.firstRowIndex);
        const sectionEnd = Math.min(end, section.lastRowIndex);

        // Ensure the first row is included
        if (sectionStart > section.firstRowIndex) {
          indexes.add(section.firstRowIndex);
        }

        for (let index = sectionStart; index <= sectionEnd; index += 1) {
          indexes.add(index);
        }

        // Ensure the last row is included
        if (sectionEnd < section.lastRowIndex) {
          indexes.add(section.lastRowIndex);
        }
      }

      if (focusedRowIndex != null) {
        indexes.add(focusedRowIndex);
      }

      return Array.from(indexes).sort((a, b) => a - b);
    },
    [list, focusedRowIndex]
  );

  const getItemKey = useCallback(
    (index: number) => {
      return list.listItems[index].key;
    },
    [list]
  );

  const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: list.count,
    getScrollElement,
    estimateSize,
    rangeExtractor,
    getItemKey,
    overscan,
    scrollPaddingStart: 20,
    scrollPaddingEnd: 20,
  });

  const totalHeight = virtualizer.getTotalSize();
  const virtualItems = virtualizer.getVirtualItems();

  const layout = useMemo(() => {
    return buildLayout(list, virtualItems, totalHeight);
  }, [list, virtualItems, totalHeight]);

  return [virtualizer, layout];
}
