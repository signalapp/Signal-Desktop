// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import * as MIME from '../../types/MIME.std.js';

describe('MIME', () => {
  describe('isGif', () => {
    it('returns true for GIFs', () => {
      assert.isTrue(MIME.isGif('image/gif'));
    });

    it('returns false for non-GIFs', () => {
      assert.isFalse(MIME.isGif(''));
      assert.isFalse(MIME.isGif('gif'));
      assert.isFalse(MIME.isGif('image/jpeg'));
      assert.isFalse(MIME.isGif('text/plain'));
    });
  });

  describe('isJPEG', () => {
    it('should return true for `image/jpeg`', () => {
      assert.isTrue(MIME.isJPEG('image/jpeg'));
    });

    it('returns false for non-JPEGs', () => {
      assert.isFalse(MIME.isJPEG(''));
      assert.isFalse(MIME.isJPEG('jpg'));
      assert.isFalse(MIME.isJPEG('jpeg'));
      assert.isFalse(MIME.isJPEG('image/jpg')); // invalid MIME type: https://stackoverflow.com/a/37266399/125305
      assert.isFalse(MIME.isJPEG('image/gif'));
      assert.isFalse(MIME.isJPEG('image/tiff'));
      assert.isFalse(MIME.isJPEG('application/json'));
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
