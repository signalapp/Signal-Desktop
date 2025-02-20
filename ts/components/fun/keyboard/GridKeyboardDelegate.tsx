// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { VirtualItem, Virtualizer } from '@tanstack/react-virtual';
import { findLast, sortBy } from 'lodash';
import { strictAssert } from '../../../util/assert';
import type {
  CellKey,
  Layout,
  RowKey,
  SectionKey,
} from '../virtual/useFunVirtualGrid';
import { KeyboardDelegate } from './FunKeyboard';

const PAGE_MARGIN = 0.25; // % of scroll height

type Cell = Readonly<{
  sectionKey: SectionKey;
  rowKey: RowKey;
  cellKey: CellKey;

  sectionIndex: number;
  rowIndex: number;
  colIndex: number;

  item: VirtualItem;
}>;

type State = Readonly<{
  cell: Cell | null;
}>;

export type { State as GridKeyboardState };

function toState(state: State, cell: Cell | null): State {
  return cell != null ? { cell } : state;
}

export class GridKeyboardDelegate extends KeyboardDelegate<State> {
  #virtualizer: Virtualizer<HTMLDivElement, HTMLDivElement>;
  #layout: Layout;

  constructor(
    virtualizer: Virtualizer<HTMLDivElement, HTMLDivElement>,
    layout: Layout
  ) {
    super();
    this.#virtualizer = virtualizer;
    this.#layout = layout;
  }

  override scrollToState(state: State): void {
    if (state.cell == null) {
      return;
    }
    this.#virtualizer.scrollToIndex(state.cell.item.index);
  }

  override getInitialState(): State {
    return { cell: null };
  }

  override getKeyFromState(state: State): string | null {
    return state.cell?.cellKey ?? null;
  }

  override onFocusChange(_state: State, key: string | null): State {
    return { cell: key != null ? this.#get(key as CellKey) : null };
  }

  override onFocusLeave(_state: State): State {
    return { cell: null };
  }

  override onArrowLeft(state: State): State {
    if (state.cell == null) {
      return state;
    }
    const { sectionIndex, rowIndex, colIndex } = state.cell;
    const cells = this.#getCellsInRowOrder();
    const prevCell = this.#findLast(cells, cell => {
      return (
        // Prev cell in the same row
        (cell.sectionIndex === sectionIndex &&
          cell.rowIndex === rowIndex &&
          cell.colIndex === colIndex - 1) ||
        // Last cell in the prev row
        (cell.sectionIndex === sectionIndex &&
          cell.rowIndex === rowIndex - 1) ||
        // Last cell in prev section
        cell.sectionIndex === sectionIndex - 1
      );
    });
    return toState(state, prevCell);
  }

  override onArrowRight(state: State): State {
    if (state.cell == null) {
      return state;
    }
    const { sectionIndex, rowIndex, colIndex } = state.cell;
    const cells = this.#getCellsInRowOrder();
    const match = this.#findFirst(cells, cell => {
      return (
        // Next cell in the same row
        (cell.sectionIndex === sectionIndex &&
          cell.rowIndex === rowIndex &&
          cell.colIndex === colIndex + 1) ||
        // First cell in the next row
        (cell.sectionIndex === sectionIndex &&
          cell.rowIndex === rowIndex + 1) ||
        // First cell in next section
        cell.sectionIndex === sectionIndex + 1
      );
    });
    return toState(state, match);
  }

  override onArrowUp(state: State): State {
    if (state.cell == null) {
      return state;
    }
    const { sectionIndex, rowIndex, colIndex } = state.cell;
    const cells = this.#getCellsInColOrder();
    const match = this.#findLast(cells, cell => {
      return (
        // Same column in prev row in the same section
        (cell.sectionIndex === sectionIndex &&
          cell.colIndex === colIndex &&
          cell.rowIndex === rowIndex - 1) ||
        // Same column in last row in prev section
        (cell.sectionIndex === sectionIndex - 1 && cell.colIndex === colIndex)
      );
    });
    return toState(state, match);
  }

  override onArrowDown(state: State): State {
    if (state.cell == null) {
      return state;
    }
    const { sectionIndex, rowIndex, colIndex } = state.cell;
    const cells = this.#getCellsInColOrder();
    const match = this.#findFirst(cells, cell => {
      return (
        // Next row
        (cell.sectionIndex === sectionIndex &&
          cell.colIndex === colIndex &&
          cell.rowIndex === rowIndex + 1) ||
        // Same column in first row in next section
        (cell.sectionIndex === sectionIndex + 1 && cell.colIndex === colIndex)
      );
    });
    return toState(state, match);
  }

  override onPageUp(state: State): State {
    if (state.cell == null) {
      return state;
    }

    const { item, colIndex } = state.cell;

    const scrollTop = this.#scrollOffset;
    const margin = this.#scrollHeight * PAGE_MARGIN;
    const nearTop = item.start <= scrollTop + this.#scrollPaddingStart + margin;
    const padding = this.#scrollPaddingStart + this.#scrollPaddingEnd;
    const prevPage = nearTop
      ? item.end - this.#scrollHeight + padding
      : scrollTop + padding;

    const cells = this.#getCellsInRowOrder();
    const match = this.#findFirst(cells, cell => {
      return (
        cell.item.index <= item.index &&
        cell.colIndex === colIndex &&
        cell.item.end >= prevPage
      );
    });

    return toState(state, match);
  }

  override onPageDown(state: State): State {
    if (state.cell == null) {
      return state;
    }

    const { item, colIndex } = state.cell;

    const scrollBottom = this.#scrollOffset + this.#scrollHeight;
    const margin = this.#scrollHeight * PAGE_MARGIN;
    const nearBottom =
      item.end >= scrollBottom - this.#scrollPaddingEnd - margin;
    const padding = this.#scrollPaddingStart + this.#scrollPaddingEnd;
    const nextPage = nearBottom
      ? item.start + this.#scrollHeight - padding
      : scrollBottom - padding;

    const cells = this.#getCellsInRowOrder();
    const match = this.#findLast(cells, cell => {
      return (
        cell.item.index >= item.index &&
        cell.colIndex === colIndex &&
        cell.item.start <= nextPage
      );
    });

    return toState(state, match);
  }

  override onHome(state: State): State {
    if (state.cell == null) {
      return state;
    }
    const { sectionIndex, rowIndex } = state.cell;
    const cells = this.#getCellsInRowOrder();
    const match = this.#findFirst(cells, cell => {
      return cell.sectionIndex === sectionIndex && cell.rowIndex === rowIndex;
    });
    return toState(state, match);
  }

  override onEnd(state: State): State {
    if (state.cell == null) {
      return state;
    }
    const { sectionIndex, rowIndex } = state.cell;
    const cells = this.#getCellsInRowOrder();
    const match = this.#findLast(cells, cell => {
      return cell.sectionIndex === sectionIndex && cell.rowIndex === rowIndex;
    });
    return toState(state, match);
  }

  override onModHome(state: State): State {
    if (state.cell == null) {
      return state;
    }
    const cells = this.#getCellsInRowOrder();
    const match = this.#findFirst(cells, () => true);
    return toState(state, match);
  }

  override onModEnd(state: State): State {
    if (state.cell == null) {
      return state;
    }
    const cells = this.#getCellsInRowOrder();
    const match = this.#findLast(cells, () => true);
    return toState(state, match);
  }

  get #scrollPaddingStart() {
    return this.#virtualizer.options.scrollPaddingStart ?? 0;
  }

  get #scrollPaddingEnd() {
    return this.#virtualizer.options.scrollPaddingEnd ?? 0;
  }

  get #scrollOffset() {
    return this.#virtualizer.scrollOffset ?? 0;
  }

  get #scrollHeight() {
    return this.#virtualizer.scrollRect?.height ?? 0;
  }

  #getCells(): ReadonlyArray<Cell> {
    return this.#layout.sections.flatMap(section => {
      return section.rowGroup.rows.flatMap(row => {
        return row.cells.map((cell): Cell => {
          return {
            sectionKey: section.key,
            rowKey: row.key,
            cellKey: cell.key,
            sectionIndex: section.sectionIndex,
            rowIndex: row.rowIndex,
            colIndex: cell.colIndex,
            item: row.item,
          };
        });
      });
    });
  }

  #getCellsInRowOrder() {
    return sortBy(this.#getCells(), [
      cell => cell.sectionIndex,
      cell => cell.rowIndex,
      cell => cell.colIndex,
    ]);
  }

  #getCellsInColOrder() {
    return sortBy(this.#getCells(), [
      cell => cell.sectionIndex,
      cell => cell.colIndex,
      cell => cell.rowIndex,
    ]);
  }

  #get(key: CellKey): Cell {
    const cells = this.#getCells();
    const found = this.#findFirst(cells, cell => cell.cellKey === key);
    strictAssert(found != null, `Cell not found for key ${key}`);
    return found;
  }

  #findFirst(
    cells: ReadonlyArray<Cell>,
    predicate: (cell: Cell) => boolean
  ): Cell | null {
    return cells.find(predicate) ?? null;
  }

  #findLast(
    cells: ReadonlyArray<Cell>,
    predicate: (cell: Cell) => boolean
  ): Cell | null {
    return findLast(cells, predicate) ?? null;
  }
}
