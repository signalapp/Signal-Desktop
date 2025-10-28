// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import crypto from 'node:crypto';

import {
  CipherType,
  HashType,
  hash,
  sign,
  encrypt,
  decrypt,
} from '../../Crypto.node.js';

describe('SignalContext.Crypto', () => {
  describe('hash', () => {
    it('returns SHA512 hash of the input', () => {
      const result = hash(HashType.size512, Buffer.from('signal'));
      assert.strictEqual(
        Buffer.from(result).toString('base64'),
        'WxneQjrfSlY95Bi+SAzDAr2cf3mxUXePeNYn6DILN4a8NFr9VelTbP5tGHdthi+' +
          'mrJLqMZd1I6w8CxCnmJ/OFw=='
      );
    });
  });

  describe('sign', () => {
    it('returns hmac SHA256 hash of the input', () => {
      const result = sign(Buffer.from('secret'), Buffer.from('signal'));

      assert.strictEqual(
        Buffer.from(result).toString('base64'),
        '5ewbITW27c1F7dluF9KwGcVQSxmZp6mpVhPj3ww1Sh8='
      );
    });
  });

  describe('encrypt+decrypt', () => {
    it('returns original input', () => {
      const iv = crypto.randomBytes(16);
      const key = crypto.randomBytes(32);
      const input = Buffer.from('plaintext');

      const ciphertext = encrypt(CipherType.AES256CBC, {
        key,
        iv,
        plaintext: input,
      });
      const plaintext = decrypt(CipherType.AES256CBC, {
        key,
        iv,
        ciphertext,
      });

      assert.strictEqual(Buffer.from(plaintext).toString(), 'plaintext');
    });
  });
});
