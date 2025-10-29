// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from './assert.dom.js';

export type ScrollbarWidth = 'wide' | 'thin' | 'none';
export type ScrollbarColor = 'native' | 'custom';

const ScrollbarWidths: Record<ScrollbarWidth, string> = {
  wide: 'auto',
  thin: 'thin',
  none: 'none',
};

const ScrollbarColors: Record<ScrollbarColor, string> = {
  native: 'auto',
  custom: 'black transparent',
};

export type ScrollbarGutters = Readonly<{
  vertical: number;
  horizontal: number;
}>;

const SCROLLBAR_GUTTERS_CACHE = new Map<string, ScrollbarGutters>();

function isValidClientSize(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

export function getScrollbarGutters(
  scrollbarWidth: ScrollbarWidth,
  scrollbarColor: ScrollbarColor
): ScrollbarGutters {
  const cacheKey = `${scrollbarWidth}, ${scrollbarColor}`;
  const cached = SCROLLBAR_GUTTERS_CACHE.get(cacheKey);
  if (cached != null) {
    return cached;
  }

  const outer = document.createElement('div');
  const inner = document.createElement('div');

  // Use `all: initial` to avoid other styles affecting the measurement
  // This resets elements to their initial value (such as `display: inline`)
  outer.style.setProperty('all', 'initial');
  outer.style.setProperty('display', 'block');
  outer.style.setProperty('visibility', 'hidden');
  outer.style.setProperty('overflow', 'auto');
  outer.style.setProperty('width', '100px');
  outer.style.setProperty('height', '100px');
  outer.style.setProperty('scrollbar-width', ScrollbarWidths[scrollbarWidth]);
  outer.style.setProperty('scrollbar-color', ScrollbarColors[scrollbarColor]);

  inner.style.setProperty('all', 'initial');
  inner.style.setProperty('display', 'block');
  inner.style.setProperty('width', '101px');
  inner.style.setProperty('height', '101px');

  outer.append(inner);

  // Insert the element into the DOM to get non-zero measurements
  document.body.append(outer);
  const { offsetWidth, offsetHeight, clientWidth, clientHeight } = outer;
  outer.remove();

  assert(offsetWidth === 100, 'offsetWidth must be exactly 100px');
  assert(offsetHeight === 100, 'offsetHeight must be exactly 100px');
  assert(
    isValidClientSize(clientWidth),
    'clientWidth must be non-zero positive integer'
  );
  assert(
    isValidClientSize(clientHeight),
    'clientHeight must be non-zero positive integer'
  );

  const vertical = offsetWidth - clientWidth;
  const horizontal = offsetHeight - clientHeight;

  const result: ScrollbarGutters = { vertical, horizontal };
  SCROLLBAR_GUTTERS_CACHE.set(cacheKey, result);
  return result;
}
