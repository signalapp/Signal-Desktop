// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  isAttachmentTooLarge,
  MEBIBYTE,
} from '../../types/AttachmentSize.std.ts';

describe('AttachmentSize', () => {
  describe('isAttachmentTooLarge', () => {
    it('compares padded ciphertext size against the limit', () => {
      const ciphertextLimit = 200 * MEBIBYTE;

      // Largest plaintext whose padded ciphertext (202,397,600) fits
      assert.isFalse(
        isAttachmentTooLarge({ plaintextSize: 202397542, ciphertextLimit })
      );
      // Next padding bucket's ciphertext (212,517,472) exceeds the limit
      assert.isTrue(
        isAttachmentTooLarge({ plaintextSize: 202397543, ciphertextLimit })
      );
      // Plaintext is under the limit, but padded ciphertext is not
      assert.isTrue(
        isAttachmentTooLarge({ plaintextSize: 205000000, ciphertextLimit })
      );
    });
  });
});
