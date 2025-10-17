// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { isValidUuid } from '../../util/isValidUuid.std.js';

describe('isValidUuid', () => {
  const LOWERCASE_V4_UUID = '9cb737ce-2bb3-4c21-9fe0-d286caa0ca68';

  it('returns false for non-strings', () => {
    assert.isFalse(isValidUuid(undefined));
    assert.isFalse(isValidUuid(null));
    assert.isFalse(isValidUuid(1234));
  });

  it('returns false for non-UUID strings', () => {
    assert.isFalse(isValidUuid(''));
    assert.isFalse(isValidUuid('hello world'));
    assert.isFalse(isValidUuid(` ${LOWERCASE_V4_UUID}`));
    assert.isFalse(isValidUuid(`${LOWERCASE_V4_UUID} `));
  });

  it("returns false for UUIDs that aren't version 4", () => {
    assert.isFalse(isValidUuid('a200a6e0-d2d9-11eb-bda7-dd5936a30ddf'));
    assert.isFalse(isValidUuid('2adb8b83-4f2c-55ca-a481-7f98b716e615'));
  });

  it('returns true for v4 UUIDs', () => {
    assert.isTrue(isValidUuid(LOWERCASE_V4_UUID));
    assert.isTrue(isValidUuid(LOWERCASE_V4_UUID.toUpperCase()));
  });
});
