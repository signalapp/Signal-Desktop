// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { groupWhile, formatGroups } from '../../util/groupWhile';

describe('groupWhile/formatGroups', () => {
  function check(
    input: Array<number>,
    expected: Array<Array<number>>,
    expectedFormatted: string
  ) {
    const result = groupWhile(input, (item, prev) => {
      return prev + 1 === item;
    });
    assert.deepEqual(result, expected);
    const formatted = formatGroups(result, '-', ', ', String);
    assert.equal(formatted, expectedFormatted);
  }

  it('empty', () => {
    check([], [], '');
  });

  it('one', () => {
    check([1], [[1]], '1');
  });

  it('sequential', () => {
    check([1, 2, 3, 4, 5, 6], [[1, 2, 3, 4, 5, 6]], '1-6');
  });

  it('non-sequential', () => {
    check(
      [1, 2, 4, 5],
      [
        [1, 2],
        [4, 5],
      ],
      '1-2, 4-5'
    );
  });

  it('multiple non-sequential', () => {
    check(
      [1, 2, 4, 5, 7, 9, 10],
      [[1, 2], [4, 5], [7], [9, 10]],
      '1-2, 4-5, 7, 9-10'
    );
  });

  function range(start: number, end: number) {
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }

  it('huge', () => {
    check(
      [...range(1, 100), ...range(102, 200), ...range(202, 300)],
      [range(1, 100), range(102, 200), range(202, 300)],
      '1-100, 102-200, 202-300'
    );
  });
});
