// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Buffer } from 'buffer';
import type { Decipher } from 'crypto';
import crypto from 'crypto';

import { strictAssert } from '../util/assert';
import type { HashType } from '../types/Crypto';
import { CipherType } from '../types/Crypto';

const AUTH_TAG_SIZE = 16;

export class Crypto {
  public sign(key: Uint8Array, data: Uint8Array): Uint8Array {
    return crypto
      .createHmac('sha256', Buffer.from(key))
      .update(Buffer.from(data))
      .digest();
  }

  public hash(type: HashType, data: Uint8Array): Uint8Array {
    return crypto.createHash(type).update(Buffer.from(data)).digest();
  }

  public encrypt(
    cipherType: CipherType,
    {
      key,
      plaintext,
      iv,
      aad,
    }: Readonly<{
      key: Uint8Array;
      plaintext: Uint8Array;
      iv: Uint8Array;
      aad?: Uint8Array;
    }>
  ): Uint8Array {
    if (cipherType === CipherType.AES256GCM) {
      const gcm = crypto.createCipheriv(
        cipherType,
        Buffer.from(key),
        Buffer.from(iv)
      );

      if (aad) {
        gcm.setAAD(aad);
      }

      const first = gcm.update(Buffer.from(plaintext));
      const last = gcm.final();
      const tag = gcm.getAuthTag();
      strictAssert(tag.length === AUTH_TAG_SIZE, 'Invalid auth tag size');

      return Buffer.concat([first, last, tag]);
    }

    strictAssert(aad === undefined, `AAD is not supported for: ${cipherType}`);
    const cipher = crypto.createCipheriv(
      cipherType,
      Buffer.from(key),
      Buffer.from(iv)
    );
    return Buffer.concat([
      cipher.update(Buffer.from(plaintext)),
      cipher.final(),
    ]);
  }

  public decrypt(
    cipherType: CipherType,
    {
      key,
      ciphertext,
      iv,
      aad,
    }: Readonly<{
      key: Uint8Array;
      ciphertext: Uint8Array;
      iv: Uint8Array;
      aad?: Uint8Array;
    }>
  ): Uint8Array {
    let decipher: Decipher;
    let input = Buffer.from(ciphertext);
    if (cipherType === CipherType.AES256GCM) {
      const gcm = crypto.createDecipheriv(
        cipherType,
        Buffer.from(key),
        Buffer.from(iv)
      );

      if (input.length < AUTH_TAG_SIZE) {
        throw new Error('Invalid GCM ciphertext');
      }

      const tag = input.slice(input.length - AUTH_TAG_SIZE);
      input = input.slice(0, input.length - AUTH_TAG_SIZE);

      gcm.setAuthTag(tag);

      if (aad) {
        gcm.setAAD(aad);
      }

      decipher = gcm;
    } else {
      strictAssert(
        aad === undefined,
        `AAD is not supported for: ${cipherType}`
      );
      decipher = crypto.createDecipheriv(
        cipherType,
        Buffer.from(key),
        Buffer.from(iv)
      );
    }
    return Buffer.concat([decipher.update(input), decipher.final()]);
  }

  public getRandomBytes(size: number): Uint8Array {
    return crypto.randomBytes(size);
  }

  public constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
    return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
  }
}
