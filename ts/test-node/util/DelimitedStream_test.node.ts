// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { DelimitedStream } from '../../util/DelimitedStream.node.ts';
import { encodeDelimited } from '../../util/encodeDelimited.std.ts';

describe('DelimitedStream', () => {
  function collect(out: Array<string>): Writable {
    return new Writable({
      write(data, _enc, callback) {
        out.push(data.toString());
        callback(null);
      },
    });
  }

  async function strideTest(
    data: Uint8Array<ArrayBuffer>,
    result: ReadonlyArray<string>
  ): Promise<void> {
    // Just to keep reasonable run times
    const decrease = Math.max(1, Math.round(data.length / 256));

    for (let stride = data.length; stride > 0; stride -= decrease) {
      const out = new Array<string>();

      // oxlint-disable-next-line no-await-in-loop
      await pipeline(
        Readable.from(
          (function* () {
            for (let offset = 0; offset < data.length; offset += stride) {
              yield data.subarray(offset, offset + stride);
            }
          })()
        ),
        new DelimitedStream(),
        collect(out)
      );

      assert.deepStrictEqual(out, result, `Stride: ${stride}`);
    }
  }

  it('should parse single-byte delimited data', async () => {
    const data = Buffer.concat([
      ...encodeDelimited(Buffer.from('a')),
      ...encodeDelimited(Buffer.from('bc')),
    ]);

    await strideTest(data, ['a', 'bc']);
  });

  it('should parse two-byte delimited data', async () => {
    const data = Buffer.concat([
      ...encodeDelimited(Buffer.from('a'.repeat(129))),
      ...encodeDelimited(Buffer.from('b'.repeat(154))),
    ]);

    await strideTest(data, ['a'.repeat(129), 'b'.repeat(154)]);
  });

  it('should parse three-byte delimited data', async () => {
    const data = Buffer.concat([
      ...encodeDelimited(Buffer.from('a'.repeat(32000))),
      ...encodeDelimited(Buffer.from('b'.repeat(32500))),
    ]);

    await strideTest(data, ['a'.repeat(32000), 'b'.repeat(32500)]);
  });

  it('should parse mixed delimited data', async () => {
    const data = Buffer.concat([
      ...encodeDelimited(Buffer.from('a')),
      ...encodeDelimited(Buffer.from('b'.repeat(129))),
      ...encodeDelimited(Buffer.from('c'.repeat(32000))),
      ...encodeDelimited(Buffer.from('d'.repeat(32))),
      ...encodeDelimited(Buffer.from('e'.repeat(415))),
      ...encodeDelimited(Buffer.from('f'.repeat(33321))),
    ]);

    await strideTest(data, [
      'a',
      'b'.repeat(129),
      'c'.repeat(32000),
      'd'.repeat(32),
      'e'.repeat(415),
      'f'.repeat(33321),
    ]);
  });

  it('should error on incomplete prefix', async () => {
    const data = Buffer.concat([
      ...encodeDelimited(Buffer.from('a'.repeat(32000))),
    ]);

    const out = new Array<string>();
    await assert.isRejected(
      pipeline(
        Readable.from(data.subarray(0, 1)),
        new DelimitedStream(),
        collect(out)
      ),
      'Unfinished prefix'
    );
  });

  it('should error on incomplete data', async () => {
    const data = Buffer.concat([
      ...encodeDelimited(Buffer.from('a'.repeat(32000))),
    ]);

    const out = new Array<string>();
    await assert.isRejected(
      pipeline(
        Readable.from(data.subarray(0, 10)),
        new DelimitedStream(),
        collect(out)
      ),
      'Unfinished frame'
    );
  });

  it('should error on prefix overflow', async () => {
    const out = new Array<string>();
    await assert.isRejected(
      pipeline(
        Readable.from(Buffer.from([0xff, 0xff, 0xff, 0xff, 0xff])),
        new DelimitedStream(),
        collect(out)
      ),
      'Delimiter encoding overflow'
    );
  });
});
