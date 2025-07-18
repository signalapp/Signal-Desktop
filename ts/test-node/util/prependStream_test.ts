// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { prependStream } from '../../util/prependStream';

describe('prependStream', () => {
  it('should prepend stream with a prefix', async () => {
    const stream = prependStream(Buffer.from('prefix:'));
    stream.end('hello');

    const chunks = new Array<Buffer>();
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    const buf = Buffer.concat(chunks);
    assert.strictEqual(buf.toString(), 'prefix:hello');
  });
});
