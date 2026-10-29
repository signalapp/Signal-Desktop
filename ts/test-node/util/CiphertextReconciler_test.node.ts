// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { Buffer } from 'node:buffer';
import { PassThrough } from 'node:stream';

import { text } from '../../test-helpers/iterables.node.ts';
import { CiphertextReconciler } from '../../util/CiphertextReconciler.node.ts';

async function test(input: Array<[string, number]>, output: string) {
  const pass = new PassThrough();
  const chunks = new Array<Uint8Array<ArrayBuffer>>();
  pass.on('data', chunk => chunks.push(chunk));

  let ciphertext: Uint8Array<ArrayBuffer> | undefined;
  pass.on('end', () => {
    ciphertext = Buffer.concat(chunks);
  });

  let isRemoved = false;
  const c = new CiphertextReconciler({
    writableStream: pass,
    read: async ({ start, end }) => {
      assert(ciphertext != null, 'Ciphertext not terminated!');
      return ciphertext.subarray(start, end);
    },
    removeFile: async () => {
      assert.isFalse(isRemoved);
      isRemoved = true;
    },
  });

  for (const [chunk, offset] of input) {
    // oxlint-disable-next-line no-await-in-loop
    await c.write(Buffer.from(chunk), offset);
  }

  assert.strictEqual(await text(c.reconcile()), output);
  assert.isTrue(isRemoved);
  assert.strictEqual(c.plaintextSize, Buffer.byteLength(output));
}

describe('CiphertextReconciler', () => {
  it('reconciles ciphertext', async () => {
    await test(
      [
        ['hello Wo', 0],
        ['rld', 8],
        ['wO', 6],
        ['EL', 1],
      ],
      'hELlo wOrld'
    );
  });

  it('reconciles nested ciphertext', async () => {
    await test(
      [
        ['12345678', 0],
        ['abcdef', 1],
        ['BCDE', 2],
        ['$#', 3],
      ],
      '1aB$#Ef8'
    );
  });

  it('reconciles with overlapping boundaries', async () => {
    await test(
      [
        ['012345678', 0],
        ['abcdef', 1],
        ['ABCD', 1],
        ['$#', 1],
      ],
      '0$#CDef78'
    );
  });

  it('throws on gap in input', async () => {
    await assert.isRejected(
      test(
        [
          ['hello', 0],
          ['world', 6],
        ],
        'hello world'
      ),
      'Source material has gaps'
    );
  });
});
