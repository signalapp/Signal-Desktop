// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import assert from 'node:assert/strict';
import { getFileDurations } from './getFileDurations.mjs';

describe('getFileDurations', () => {
  it('sums the tests of each file in milliseconds', () => {
    const tests = [
      { file_name: 'ts/a_test.node.ts', duration_avg: 1.5 },
      { file_name: 'ts/a_test.node.ts', duration_avg: 2.25 },
      { file_name: 'ts/b_test.node.ts', duration_avg: 0.1234 },
    ];

    assert.deepEqual(getFileDurations([tests]), {
      'ts/a_test.node.ts': 3750,
      'ts/b_test.node.ts': 123,
    });
  });

  it('uses the slowest variant for each file', () => {
    const withE164 = [
      { file_name: 'ts/a_test.node.ts', duration_avg: 10 },
      { file_name: 'ts/a_test.node.ts', duration_avg: 10 },
      { file_name: 'ts/b_test.node.ts', duration_avg: 5 },
    ];
    const withoutE164 = [
      { file_name: 'ts/a_test.node.ts', duration_avg: 15 },
      { file_name: 'ts/b_test.node.ts', duration_avg: 8 },
      { file_name: 'ts/c_test.node.ts', duration_avg: 1 },
    ];

    assert.deepEqual(getFileDurations([withE164, withoutE164]), {
      'ts/a_test.node.ts': 20_000,
      'ts/b_test.node.ts': 8000,
      'ts/c_test.node.ts': 1000,
    });
  });

  it('ignores tests without a file or duration', () => {
    const tests = [
      { file_name: 'ts/a_test.node.ts', duration_avg: null },
      { file_name: null, duration_avg: 3 },
      { duration_avg: 3 },
      { file_name: 'ts/b_test.node.ts', duration_avg: 2 },
    ];

    assert.deepEqual(getFileDurations([tests]), {
      'ts/b_test.node.ts': 2000,
    });
  });

  it('returns nothing without tests', () => {
    assert.deepEqual(getFileDurations([[], []]), {});
  });
});
