// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { combineNames } from '../../util/combineNames.std.js';

describe('combineNames', () => {
  it('returns undefined if no names provided', () => {
    assert.strictEqual(combineNames('', ''), undefined);
  });

  it('returns first name only if family name not provided', () => {
    assert.strictEqual(combineNames('Alice'), 'Alice');
  });

  it('returns returns combined names', () => {
    assert.strictEqual(combineNames('Alice', 'Jones'), 'Alice Jones');
  });

  it('returns given name first if names in Chinese', () => {
    assert.strictEqual(combineNames('振宁', '杨'), '杨振宁');
  });

  it('returns given name first if names in Japanese', () => {
    assert.strictEqual(combineNames('泰夫', '木田'), '木田泰夫');
  });

  it('returns given name first if names in Korean', () => {
    assert.strictEqual(combineNames('채원', '도윤'), '도윤채원');
  });
});
