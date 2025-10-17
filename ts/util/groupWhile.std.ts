// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Accepts an array and a predicate function. Returns an array of arrays, where
 * each time the predicate returns false, a new sub-array is started.
 *
 * Useful for grouping sequential items in an array.
 *
 * @example
 * ```ts
 * groupWhile([1, 2, 3, 4, 5, 6], (item, prev) => {
 *   return prev + 1 === item
 * })
 * // => [[1, 2, 3], [4, 5, 6]]
 * ```
 */
export function groupWhile<T>(
  array: ReadonlyArray<T>,
  iteratee: (item: T, prev: T) => boolean
): Array<Array<T>> {
  const groups: Array<Array<T>> = [];
  let cursor = 0;
  while (cursor < array.length) {
    const group: Array<T> = [];
    do {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      group.push(array[cursor]!);
      cursor += 1;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if (!iteratee(array[cursor]!, array[cursor - 1]!)) {
        break;
      }
    } while (cursor < array.length);
    groups.push(group);
  }
  return groups;
}

/**
 * @example
 * ```ts
 * let result = [[1, 2], [4, 5], [7], [9, 10]]
 * let formatted = formatGroups(result, "-", ", ", String)
 * // => "1-2, 4-5, 7, 9-10"
 * ```
 */
export function formatGroups<T>(
  groups: Array<Array<T>>,
  rangeSeparator: string,
  groupSeparator: string,
  formatItem: (value: T) => string
): string {
  return groups
    .map(group => {
      if (group.length === 0) {
        return '';
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const start = formatItem(group.at(0)!);
      if (group.length === 1) {
        return start;
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const end = formatItem(group.at(-1)!);
      return `${start}${rangeSeparator}${end}`;
    })
    .join(groupSeparator);
}
