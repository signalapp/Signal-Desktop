// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { VirtualItem, Virtualizer } from '@tanstack/react-virtual';
import { findLast, maxBy } from 'lodash';
import { strictAssert } from '../../../util/assert';
import { KeyboardDelegate } from './FunKeyboard';

const PAGE_MARGIN = 0.25; // % of scroll height

enum Mode {
  Grid = 'Grid', // (default)
  List = 'List',
}

type Key = string & { Key: never };

type Stack = ReadonlyArray<Key>;

type State = Readonly<{
  mode: Mode;
  key: Key | null;
  stack: Stack;
}>;

export type { State as WaterfallKeyboardState };

const initialState: State = {
  mode: Mode.Grid,
  key: null,
  stack: [],
};

function toGridState(state: State, key: Key | null, stack: Stack): State {
  return key != null ? { mode: Mode.Grid, key, stack } : state;
}

function toListState(state: State, key: Key | null, stack: Stack): State {
  return key != null ? { mode: Mode.List, key, stack } : state;
}

function toKey(item: VirtualItem | null): Key | null {
  if (item == null) {
    return null;
  }
  return String(item.key) as Key;
}

export class WaterfallKeyboardDelegate extends KeyboardDelegate<State> {
  #virtualizer: Virtualizer<HTMLDivElement, HTMLDivElement>;

  constructor(virtualizer: Virtualizer<HTMLDivElement, HTMLDivElement>) {
    super();
    this.#virtualizer = virtualizer;
  }

  override getInitialState(): State {
    return initialState;
  }

  override getKeyFromState(state: State): Key | null {
    return state.key;
  }

  override scrollToState(state: State): void {
    if (state.key == null) {
      return;
    }
    const item = this.#get(state.key);
    this.#virtualizer.scrollToIndex(item.index);
  }

  override onFocusChange(state: State, key: Key | null): State {
    return toGridState(state, key, []);
  }

  override onFocusLeave(_state: State): State {
    return initialState;
  }

  override onArrowLeft(state: State): State {
    const fromKey = state.key;
    if (fromKey == null) {
      return state;
    }

    if (state.mode === Mode.Grid) {
      // First try to go back in the stack if we have one
      const stackLastIndex = state.stack.at(-1);
      if (stackLastIndex != null) {
        return toGridState(state, stackLastIndex, state.stack.slice(0, -1));
      }

      const rowPrevIndex = this.#getPrevKeyInRow(fromKey);
      if (rowPrevIndex != null) {
        return toGridState(state, rowPrevIndex, []);
      }
    }

    // Note: Grid mode falls back to list mode
    const listPrevIndex = this.#getPrevKeyInList(fromKey);
    if (listPrevIndex != null) {
      return toListState(state, listPrevIndex, []);
    }

    return state;
  }

  override onArrowRight(state: State): State {
    const fromKey = state.key;
    if (fromKey == null) {
      return state;
    }

    if (state.mode === Mode.Grid) {
      const rowNextKey = this.#getNextKeyInRow(fromKey);
      if (rowNextKey != null) {
        return toGridState(
          state,
          rowNextKey,
          state.key != null ? [...state.stack, state.key] : []
        );
      }
    }

    // Note: Grid mode falls back to list mode
    const listNextKey = this.#getNextKeyInList(fromKey);
    return toListState(state, listNextKey, []);
  }

  override onArrowUp(state: State): State {
    if (state.key == null) {
      return state;
    }
    const fromItem = this.#get(state.key);
    const prevItem = this.#findLast(item => {
      return item.index < fromItem.index && item.lane === fromItem.lane;
    });
    return toGridState(state, toKey(prevItem), []);
  }

  override onArrowDown(state: State): State {
    if (state.key == null) {
      return state;
    }
    const fromItem = this.#get(state.key);
    const nextItem = this.#findFirst(item => {
      return item.index > fromItem.index && item.lane === fromItem.lane;
    });
    return toGridState(state, toKey(nextItem), []);
  }

  override onPageUp(state: State): State {
    if (state.key == null) {
      return state;
    }

    const fromItem = this.#get(state.key);

    const scrollTop = this.#scrollOffset;
    const margin = this.#scrollHeight * PAGE_MARGIN;
    const nearTop =
      fromItem.start <= scrollTop + this.#scrollPaddingStart + margin;
    const padding = this.#scrollPaddingStart + this.#scrollPaddingEnd;
    const prevPage = nearTop
      ? fromItem.end - this.#scrollHeight + padding
      : scrollTop + padding;

    const match = this.#findFirst(item => {
      return (
        item.index <= fromItem.index &&
        item.lane === fromItem.lane &&
        item.end >= prevPage
      );
    });

    return toGridState(state, toKey(match), []);
  }

  override onPageDown(state: State): State {
    if (state.key == null) {
      return state;
    }
    const fromItem = this.#get(state.key);

    const scrollBottom = this.#scrollOffset + this.#scrollHeight;
    const margin = this.#scrollHeight * PAGE_MARGIN;
    const nearBottom =
      fromItem.end >= scrollBottom - this.#scrollPaddingEnd - margin;
    const padding = this.#scrollPaddingStart + this.#scrollPaddingEnd;
    const nextPage = nearBottom
      ? fromItem.start + this.#scrollHeight - padding
      : scrollBottom - padding;

    const match = this.#findLast(item => {
      return (
        item.index >= fromItem.index &&
        item.lane === fromItem.lane &&
        item.start <= nextPage
      );
    });

    return toGridState(state, toKey(match), []);
  }

  override onHome(state: State): State {
    if (state.key == null) {
      return state;
    }
    const fromItem = this.#get(state.key);
    const firstLane = 0;
    if (fromItem.lane === firstLane) {
      return state;
    }
    const firstItems = this.#filter(item => {
      return item.lane === firstLane && this.#isIntersectingRow(fromItem, item);
    });
    const maxItem = maxBy(firstItems, item => {
      return this.#getRowVisibleIntersectionRatio(fromItem, item);
    });
    return toGridState(state, toKey(maxItem ?? null), []);
  }

  override onEnd(state: State): State {
    if (state.key == null) {
      return state;
    }
    const fromItem = this.#get(state.key);
    const lastLane = this.#lanes - 1;
    if (fromItem.lane === lastLane) {
      return state;
    }
    const lastItems = this.#filter(item => {
      return item.lane === lastLane && this.#isIntersectingRow(fromItem, item);
    });
    const maxItem = maxBy(lastItems, item => {
      return this.#getRowVisibleIntersectionRatio(fromItem, item);
    });
    return toGridState(state, toKey(maxItem ?? null), []);
  }

  override onModHome(state: State): State {
    const firstItem = this.#findFirst(() => true);
    return toGridState(state, toKey(firstItem), []);
  }

  override onModEnd(state: State): State {
    const lastItem = this.#findLast(() => true);
    return toGridState(state, toKey(lastItem), []);
  }

  get #lanes() {
    return this.#virtualizer.options.lanes;
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

  #get(key: string): VirtualItem {
    const match = this.#findFirst(item => String(item.key) === key);
    strictAssert(match != null, `Missing item for key ${key}`);
    return match;
  }

  #findFirst(predicate: (item: VirtualItem) => boolean): VirtualItem | null {
    return this.#virtualizer.getVirtualItems().find(predicate) ?? null;
  }

  #findLast(predicate: (item: VirtualItem) => boolean): VirtualItem | null {
    return findLast(this.#virtualizer.getVirtualItems(), predicate) ?? null;
  }

  #filter(predicate: (item: VirtualItem) => boolean): Array<VirtualItem> {
    return this.#virtualizer.getVirtualItems().filter(predicate);
  }

  #isIntersectingRow(from: VirtualItem, to: VirtualItem): boolean {
    return !(to.start > from.end || to.end < from.start);
  }

  #getRowVisibleIntersectionRatio(from: VirtualItem, to: VirtualItem) {
    const scrollTop = this.#scrollOffset;
    const scrollBottom = scrollTop + this.#scrollHeight;

    const fromStart = Math.max(from.start, scrollTop);
    const fromEnd = Math.min(from.end, scrollBottom);

    const toStart = Math.max(to.start, scrollTop);
    const toEnd = Math.min(to.end, scrollBottom);

    const visibleOverlapStart = Math.max(fromStart, toStart);
    const visibleOverlapEnd = Math.min(fromEnd, toEnd);

    if (visibleOverlapStart >= visibleOverlapEnd) {
      return 0;
    }

    const visibleOverlap = visibleOverlapEnd - visibleOverlapStart;
    const visibleSize = toEnd - toStart;
    return visibleOverlap / visibleSize;
  }

  #getNextKeyInList(fromKey: Key): Key | null {
    const fromItem = this.#get(fromKey);
    const nextItem = this.#findFirst(item => item.index > fromItem.index);
    return toKey(nextItem ?? null);
  }

  #getPrevKeyInList(fromKey: Key): Key | null {
    const fromItem = this.#get(fromKey);
    const prevItem = this.#findLast(item => item.index < fromItem.index);
    return toKey(prevItem ?? null);
  }

  #getNextKeyInRow(fromKey: Key): Key | null {
    const fromItem = this.#get(fromKey);
    const nextLane = fromItem.lane + 1;
    if (nextLane >= this.#lanes) {
      return null;
    }
    const nextItems = this.#filter(item => {
      return item.lane === nextLane && this.#isIntersectingRow(fromItem, item);
    });
    const maxItem = maxBy(nextItems, item => {
      return this.#getRowVisibleIntersectionRatio(fromItem, item);
    });
    return toKey(maxItem ?? null);
  }

  #getPrevKeyInRow(fromKey: Key): Key | null {
    const fromItem = this.#get(fromKey);
    const prevLane = fromItem.lane - 1;
    if (prevLane < 0) {
      return null;
    }
    const prevItems = this.#filter(item => {
      return item.lane === prevLane && this.#isIntersectingRow(fromItem, item);
    });
    const maxItem = maxBy(prevItems, item => {
      return this.#getRowVisibleIntersectionRatio(fromItem, item);
    });
    return toKey(maxItem ?? null);
  }
}
