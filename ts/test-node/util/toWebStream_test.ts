// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { Readable } from 'node:stream';
import { once } from 'node:events';
import { toWebStream } from '../../util/toWebStream';

describe('toWebStream', () => {
  it('only reads what it needs', async () => {
    const CHUNK_SIZE = 16 * 1024;
    let pushed = 0;
    const readable = new Readable({
      read() {
        pushed += 1;
        this.push(Buffer.alloc(CHUNK_SIZE));
      },
    });

    const reader = toWebStream(readable).getReader();
    const { value, done } = await reader.read();

    // One to be read, one buffered
    assert.strictEqual(pushed, 2);
    assert.isFalse(done);
    assert.strictEqual(value?.byteLength, 2 * CHUNK_SIZE);
  });

  it('closes controller on end', async () => {
    const readable = Readable.from([
      Buffer.from('hello '),
      Buffer.from('world'),
    ]);

    const reader = toWebStream(readable).getReader();
    {
      const { value, done } = await reader.read();
      assert.strictEqual(value?.toString(), 'hello ');
      assert.isFalse(done);
    }
    {
      const { value, done } = await reader.read();
      assert.strictEqual(value?.toString(), 'world');
      assert.isFalse(done);
    }
    {
      const { value, done } = await reader.read();
      assert.isUndefined(value);
      assert.isTrue(done);
    }
  });

  it('handles premature close', async () => {
    const readable = new Readable({
      read() {
        // no-op
      },
    });

    const reader = toWebStream(readable).getReader();
    readable.destroy();
    await assert.isRejected(reader.read(), 'Premature close');
  });

  it('handles error close', async () => {
    const readable = new Readable({
      read() {
        // no-op
      },
    });

    const reader = toWebStream(readable).getReader();
    readable.destroy(new Error('error msg'));
    await assert.isRejected(reader.read(), 'error msg');
  });

  it('can be wrapped and destroyed during data read', async () => {
    const readable = new Readable({
      read() {
        this.push(Buffer.from('hello'));
      },
    });

    const web = toWebStream(readable);

    // Some sort of mismatch between Node's expectation for ReadStream and
    // what TS says ReadStream is in WebAPIs.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = Readable.fromWeb(web as any);
    node.on('data', () => {
      node.destroy();
    });
    await once(node, 'close');
  });
});
