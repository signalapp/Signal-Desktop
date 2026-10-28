// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { assert } from 'chai';
import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';

import { NodeInputStream } from '../../util/NodeInputStream.node.ts';

describe('NodeInputStream', () => {
  it('reads chunk in the middle of the stream', async () => {
    const input = Readable.from([Buffer.from('prefixcontentend')]);

    const stream = new NodeInputStream(input);
    await stream.skip('prefix'.length);
    const data = await stream.read('content'.length);
    assert.strictEqual(data.toString(), 'content');
    await stream.close();
  });

  it('reads chunk past the end of the stream', async () => {
    const input = Readable.from([Buffer.from('prefixcontent')]);

    const stream = new NodeInputStream(input);
    await stream.skip('prefix'.length);
    {
      const data = await stream.read(1);
      assert.strictEqual(data.toString(), 'c');
    }
    {
      const data = await stream.read(6);
      assert.strictEqual(data.toString(), 'ontent');
    }
    {
      const data = await stream.read(1024);
      assert.strictEqual(data.toString(), '');
    }
    await stream.close();
  });

  it('handles stream errors', async () => {
    const input = Readable.from([Buffer.from('prefixcontent')]);

    const stream = new NodeInputStream(input);
    await stream.read(1024);
    input.emit('error', new Error('hello'));

    await assert.isRejected(stream.close(), 'hello');
  });
});
