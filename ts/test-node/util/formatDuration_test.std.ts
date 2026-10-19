// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  formatDuration,
  formatDurationInMs,
} from '../../util/formatDuration.std.ts';
import { HOUR, MINUTE, SECOND } from '../../util/durations/index.std.ts';

describe('formatDuration', () => {
  it('formats durations shorter than an hour as m:ss', () => {
    assert.strictEqual(formatDuration(0), '0:00');
    assert.strictEqual(formatDuration(5), '0:05');
    assert.strictEqual(formatDuration(65), '1:05');
    assert.strictEqual(formatDuration(59 * 60 + 59), '59:59');
  });

  it('includes hours for durations of an hour or more', () => {
    assert.strictEqual(formatDuration(60 * 60), '1:00:00');
    assert.strictEqual(formatDuration(60 * 60 + 65), '1:01:05');
    assert.strictEqual(formatDuration(2 * 60 * 60 + 30 * 60), '2:30:00');
  });
});

describe('formatDurationInMs', () => {
  it('formats durations shorter than an hour as m:ss', () => {
    assert.strictEqual(formatDurationInMs(0), '0:00');
    assert.strictEqual(formatDurationInMs(65 * SECOND), '1:05');
    assert.strictEqual(formatDurationInMs(HOUR - SECOND), '59:59');
  });

  it('includes hours for durations of an hour or more', () => {
    assert.strictEqual(formatDurationInMs(HOUR), '1:00:00');
    assert.strictEqual(
      formatDurationInMs(HOUR + MINUTE + 5 * SECOND),
      '1:01:05'
    );
  });
});
