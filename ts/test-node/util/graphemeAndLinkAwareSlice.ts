// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { graphemeAndLinkAwareSlice } from '../../util/graphemeAndLinkAwareSlice.std.js';

describe('graphemeAndLinkAwareSlice', () => {
  it('returns entire string when shorter than maximum', () => {
    const shortString = 'Hello, Signal!';
    const result = graphemeAndLinkAwareSlice(shortString, 50);

    assert.strictEqual(result.text, shortString);
    assert.isFalse(result.hasReadMore);
  });

  it('should return string longer than max but within buffer', () => {
    const input = 'Hello, Signal!';
    const result = graphemeAndLinkAwareSlice(input, 5, 10);

    assert.strictEqual(result.text, input);
    assert.isFalse(result.hasReadMore);
  });

  it('should include entire url and detect no more to read', () => {
    const input = 'Hello, Signal! https://signal.org';
    const result = graphemeAndLinkAwareSlice(input, 16, 0);

    assert.strictEqual(result.text, input);
    assert.isFalse(result.hasReadMore);
  });

  it('should include entire url and detect more to read', () => {
    const input = 'Hello, Signal! https://signal.org additional text';
    const inputProperlyTruncated = 'Hello, Signal! https://signal.org';

    const result = graphemeAndLinkAwareSlice(input, 16, 0);
    assert.strictEqual(result.text, inputProperlyTruncated);
    assert.isTrue(result.hasReadMore);
  });

  it('should truncate normally when url present after truncation', () => {
    const input = 'Hello, Signal! https://signal.org additional text';
    const inputProperlyTruncated = 'Hello, Signal!';

    const result = graphemeAndLinkAwareSlice(input, 14, 0);
    assert.strictEqual(result.text, inputProperlyTruncated);
    assert.isTrue(result.hasReadMore);
  });

  it('truncates after url when url present before and at truncation point', () => {
    const input =
      'Hello, Signal! https://signal.org additional text https://example.com/example more text';
    const inputProperlyTruncated =
      'Hello, Signal! https://signal.org additional text https://example.com/example';

    const result = graphemeAndLinkAwareSlice(input, 55, 0);
    assert.strictEqual(result.text, inputProperlyTruncated);
    assert.isTrue(result.hasReadMore);
  });

  it('truncates after url when url present at and after truncation point', () => {
    const input =
      'Hello, Signal! https://signal.org additional text https://example.com/example more text';
    const inputProperlyTruncated = 'Hello, Signal! https://signal.org';

    const result = graphemeAndLinkAwareSlice(input, 26, 0);
    assert.strictEqual(result.text, inputProperlyTruncated);
    assert.isTrue(result.hasReadMore);
  });
});
