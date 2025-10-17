// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { formatJobForInsert } from '../../jobs/formatJobForInsert.std.js';

describe('formatJobForInsert', () => {
  it('removes non-essential properties', () => {
    const input = {
      id: 'abc123',
      timestamp: 1234,
      queueType: 'test queue',
      data: { foo: 'bar' },
      extra: 'ignored',
      alsoIgnored: true,
    };
    const output = formatJobForInsert(input);

    assert.deepEqual(output, {
      id: 'abc123',
      timestamp: 1234,
      queueType: 'test queue',
      data: { foo: 'bar' },
    });
  });
});
