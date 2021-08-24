// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import * as MIME from '../../types/MIME';

describe('MIME', () => {
  describe('isGif', () => {
    it('returns true for GIFs', () => {
      assert.isTrue(MIME.isGif('image/gif'));
    });

    it('returns false for non-GIFs', () => {
      assert.isFalse(MIME.isGif('image/jpeg'));
      assert.isFalse(MIME.isGif('text/plain'));
    });
  });

  describe('isLongMessage', () => {
    it('returns true for long messages', () => {
      assert.isTrue(MIME.isLongMessage('text/x-signal-plain'));
    });

    it('returns true for other content types', () => {
      assert.isFalse(MIME.isLongMessage('text/plain'));
      assert.isFalse(MIME.isLongMessage('image/gif'));
    });
  });
});
