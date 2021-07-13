// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateUuid } from 'uuid';

import { normalizeUuid } from '../../util/normalizeUuid';

describe('normalizeUuid', () => {
  it('converts uuid to lower case', () => {
    const uuid = generateUuid();
    assert.strictEqual(normalizeUuid(uuid, 'context 1'), uuid);
    assert.strictEqual(normalizeUuid(uuid.toUpperCase(), 'context 2'), uuid);
  });

  it("throws if passed a string that's not a UUID", () => {
    assert.throws(
      () => normalizeUuid('not-uuid-at-all', 'context 3'),
      'Normalizing invalid uuid: not-uuid-at-all in context "context 3"'
    );
  });
});
