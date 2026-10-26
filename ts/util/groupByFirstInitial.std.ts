// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const IS_LETTER_REGEX = /^\p{Letter}\p{Mark}*/u;

export type FirstInitialSection<T> = Readonly<{
  // Empty string for titles without a letter
  initial: string;
  items: ReadonlyArray<T>;
}>;

function getFirstInitial(segmenter: Intl.Segmenter, title: string): string {
  for (const segment of segmenter.segment(title)) {
    if (IS_LETTER_REGEX.test(segment.segment)) {
      return segment.segment.toUpperCase();
    }
  }
  return '';
}

export function groupByFirstInitial<T>(
  items: ReadonlyArray<T>,
  getTitle: (item: T) => string
): ReadonlyArray<FirstInitialSection<T>> {
  const segmenter = new Intl.Segmenter([], { granularity: 'grapheme' });

  const groups = new Map<string, Array<T>>();
  for (const item of items) {
    const group = groups.getOrInsert(
      getFirstInitial(segmenter, getTitle(item)),
      []
    );
    group.push(item);
  }

  const initials = Array.from(groups.keys()).toSorted((a, b) => {
    if (a === '') return 1;
    if (b === '') return -1;
    return a.localeCompare(b);
  });

  return initials.map(initial => {
    return { initial, items: groups.get(initial) ?? [] };
  });
}
