// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { isValidGuid } from '../../util/isValidGuid';

describe('isValidGuid', () => {
  const LOWERCASE_V4_UUID = '9cb737ce-2bb3-4c21-9fe0-d286caa0ca68';

  it('returns false for non-strings', () => {
    assert.isFalse(isValidGuid(undefined));
    assert.isFalse(isValidGuid(null));
    assert.isFalse(isValidGuid(1234));
  });

  it('returns false for non-UUID strings', () => {
    assert.isFalse(isValidGuid(''));
    assert.isFalse(isValidGuid('hello world'));
    assert.isFalse(isValidGuid(` ${LOWERCASE_V4_UUID}`));
    assert.isFalse(isValidGuid(`${LOWERCASE_V4_UUID} `));
  });

  it("returns false for UUIDs that aren't version 4", () => {
    assert.isFalse(isValidGuid('a200a6e0-d2d9-11eb-bda7-dd5936a30ddf'));
    assert.isFalse(isValidGuid('2adb8b83-4f2c-55ca-a481-7f98b716e615'));
  });

  it('returns true for v4 UUIDs', () => {
    assert.isTrue(isValidGuid(LOWERCASE_V4_UUID));
    assert.isTrue(isValidGuid(LOWERCASE_V4_UUID.toUpperCase()));
  });
});
