// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { Readable, Writable } from 'stream';
import { pipeline } from 'stream/promises';
import { BufferWriter } from 'protobufjs';

import { DelimitedStream } from '../../util/DelimitedStream';

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
    data: Uint8Array,
    result: ReadonlyArray<string>
  ): Promise<void> {
    // Just to keep reasonable run times
    const decrease = Math.max(1, Math.round(data.length / 256));

    for (let stride = data.length; stride > 0; stride -= decrease) {
      const out = new Array<string>();

      // eslint-disable-next-line no-await-in-loop
      await pipeline(
        Readable.from(
          (function* () {
            for (let offset = 0; offset < data.length; offset += stride) {
              yield data.slice(offset, offset + stride);
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
    const w = new BufferWriter();
    w.string('a');
    w.string('bc');

    await strideTest(w.finish(), ['a', 'bc']);
  });

  it('should parse two-byte delimited data', async () => {
    const w = new BufferWriter();
    w.string('a'.repeat(129));
    w.string('b'.repeat(154));

    await strideTest(w.finish(), ['a'.repeat(129), 'b'.repeat(154)]);
  });

  it('should parse three-byte delimited data', async () => {
    const w = new BufferWriter();
    w.string('a'.repeat(32000));
    w.string('b'.repeat(32500));

    await strideTest(w.finish(), ['a'.repeat(32000), 'b'.repeat(32500)]);
  });

  it('should parse mixed delimited data', async () => {
    const w = new BufferWriter();
    w.string('a');
    w.string('b'.repeat(129));
    w.string('c'.repeat(32000));
    w.string('d'.repeat(32));
    w.string('e'.repeat(415));
    w.string('f'.repeat(33321));

    await strideTest(w.finish(), [
      'a',
      'b'.repeat(129),
      'c'.repeat(32000),
      'd'.repeat(32),
      'e'.repeat(415),
      'f'.repeat(33321),
    ]);
  });

  it('should error on incomplete prefix', async () => {
    const w = new BufferWriter();
    w.string('a'.repeat(32000));

    const out = new Array<string>();
    await assert.isRejected(
      pipeline(
        Readable.from(w.finish().slice(0, 1)),
        new DelimitedStream(),
        collect(out)
      ),
      'Unfinished prefix'
    );
  });

  it('should error on incomplete data', async () => {
    const w = new BufferWriter();
    w.string('a'.repeat(32000));

    const out = new Array<string>();
    await assert.isRejected(
      pipeline(
        Readable.from(w.finish().slice(0, 10)),
        new DelimitedStream(),
        collect(out)
      ),
      'Unfinished data'
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
