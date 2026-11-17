// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { assert } from 'chai';
import { packFilesByDuration } from './packFilesByDuration.mjs';

describe('packFilesByDuration', () => {
  it('places the longest files first, each into the lightest bin', () => {
    const files = ['a', 'b', 'c', 'd', 'e'];
    const durations = { a: 10, b: 50, c: 40, d: 30, e: 20 };

    assert.deepStrictEqual(packFilesByDuration(files, durations, 2), [
      { files: ['b', 'e', 'a'], duration: 80 },
      { files: ['c', 'd'], duration: 70 },
    ]);
  });

  it('breaks ties by path and by lowest bin index', () => {
    const files = ['c', 'b', 'a'];
    const durations = { a: 10, b: 10, c: 10 };

    assert.deepStrictEqual(packFilesByDuration(files, durations, 2), [
      { files: ['a', 'c'], duration: 20 },
      { files: ['b'], duration: 10 },
    ]);
  });

  it('defaults files without a saved duration to the median', () => {
    const files = ['a', 'b', 'c', 'new'];
    const durations = { a: 10, b: 30, c: 60, deleted: 1000 };

    assert.deepStrictEqual(packFilesByDuration(files, durations, 2), [
      { files: ['c', 'a'], duration: 70 },
      { files: ['b', 'new'], duration: 60 },
    ]);
  });

  it('spreads files evenly when no durations are known', () => {
    assert.deepStrictEqual(packFilesByDuration(['a', 'b', 'c'], {}, 2), [
      { files: ['a', 'c'], duration: 0 },
      { files: ['b'], duration: 0 },
    ]);
  });

  it('leaves extra bins empty', () => {
    assert.deepStrictEqual(packFilesByDuration(['a'], { a: 10 }, 2), [
      { files: ['a'], duration: 10 },
      { files: [], duration: 0 },
    ]);
  });
});
