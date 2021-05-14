// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { isByteBufferEmpty } from '../../util/isByteBufferEmpty';

describe('isByteBufferEmpty', () => {
  it('returns true for undefined', () => {
    assert.isTrue(isByteBufferEmpty(undefined));
  });

  it('returns true for object missing limit', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const brokenByteBuffer: any = {};

    assert.isTrue(isByteBufferEmpty(brokenByteBuffer));
  });

  it('returns true for object limit', () => {
    const emptyByteBuffer = new window.dcodeIO.ByteBuffer(0);

    assert.isTrue(isByteBufferEmpty(emptyByteBuffer));
  });

  it('returns false for object limit', () => {
    const byteBuffer = window.dcodeIO.ByteBuffer.wrap('AABBCC', 'hex');

    assert.isFalse(isByteBufferEmpty(byteBuffer));
  });
});
