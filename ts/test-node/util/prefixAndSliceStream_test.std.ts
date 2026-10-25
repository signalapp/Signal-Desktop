// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { prefixAndSliceStream } from '../../util/prefixAndSliceStream.std.ts';

async function collect(
  iterable: AsyncIterable<Uint8Array<ArrayBuffer>>
): Promise<string> {
  const chunks = new Array<Uint8Array<ArrayBuffer>>();
  for await (const chunk of iterable) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString();
}

async function* toIterator<T>(arr: Array<T>): AsyncIterable<T> {
  for (const chunk of arr) {
    yield chunk;
  }
}

function afterSlicingIt(
  testName: string,
  hex: string,
  start: number,
  end: number,
  prefix: string,
  expected: string
): void {
  const whole = Buffer.from(hex);
  const prefixBytes = Buffer.from(prefix);

  for (let stride = 1; stride <= Math.max(1, whole.length); stride += 1) {
    const chunks = new Array<Uint8Array<ArrayBuffer>>();
    for (let off = 0; off < whole.length; off += stride) {
      chunks.push(whole.subarray(off, off + stride));
    }

    it(`${testName} (stride=${stride})`, async () => {
      const out = prefixAndSliceStream(
        toIterator(chunks),
        start,
        end,
        prefixBytes
      );

      assert.strictEqual(await collect(out), expected);
    });
  }
}

describe('prefixAndSliceStream', () => {
  afterSlicingIt('prefixes empty input', '', 0, 0, 'prefix', 'prefix');

  afterSlicingIt('prefixes input', 'input', 0, 5, 'prefix', 'prefixinput');

  afterSlicingIt(
    'prefixes sliced input',
    '0123456789',
    2,
    6,
    'prefix',
    'prefix2345'
  );
});
