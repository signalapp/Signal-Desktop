// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { randomBytes, createHmac } from 'node:crypto';

import {
  appendMacStream,
  MAC_KEY_SIZE,
  MAC_SIZE,
} from '../../util/appendMacStream.node.js';
import { generateConfigMatrix } from '../../util/generateConfigMatrix.std.js';

describe('appendMacStream', () => {
  generateConfigMatrix({
    size: [23, 1024, 1024 * 1024],
  }).forEach(({ size }) => {
    it(`should append mac to a ${size} byte stream`, async () => {
      const macKey = randomBytes(MAC_KEY_SIZE);

      const plaintext = randomBytes(size);

      const stream = appendMacStream(macKey);
      stream.end(plaintext);

      const chunks = new Array<Buffer>();
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const buf = Buffer.concat(chunks);

      const hmac = createHmac('sha256', macKey);
      hmac.update(plaintext);
      const expectedMac = hmac.digest();

      assert.strictEqual(
        buf.subarray(0, -MAC_SIZE).toString('hex'),
        plaintext.toString('hex')
      );
      assert.strictEqual(
        buf.subarray(-MAC_SIZE).toString('hex'),
        expectedMac.toString('hex')
      );
    });
  });
});
