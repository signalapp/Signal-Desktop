// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { groupByFirstInitial } from '../../util/groupByFirstInitial.std.ts';

describe('groupByFirstInitial', () => {
  const identity = (title: string) => title;

  it('returns no sections for no items', () => {
    assert.deepEqual(groupByFirstInitial([], identity), []);
  });

  it('groups by uppercased first letter, sorted alphabetically', () => {
    assert.deepEqual(
      groupByFirstInitial(['charlie', 'Abby', 'andrew', 'Casey'], identity),
      [
        { initial: 'A', items: ['Abby', 'andrew'] },
        { initial: 'C', items: ['charlie', 'Casey'] },
      ]
    );
  });

  it('skips leading non-letters', () => {
    assert.deepEqual(groupByFirstInitial(['123 Bob', '🎉 Alice'], identity), [
      { initial: 'A', items: ['🎉 Alice'] },
      { initial: 'B', items: ['123 Bob'] },
    ]);
  });

  it('puts titles without letters in a trailing empty section', () => {
    assert.deepEqual(groupByFirstInitial(['123', 'Zed', ''], identity), [
      { initial: 'Z', items: ['Zed'] },
      { initial: '', items: ['123', ''] },
    ]);
  });

  it('keeps combining marks with their letter', () => {
    assert.deepEqual(groupByFirstInitial(['éclair'], identity), [
      { initial: 'É', items: ['éclair'] },
    ]);
  });
});
