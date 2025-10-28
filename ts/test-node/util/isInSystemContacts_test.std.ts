// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { isInSystemContacts } from '../../util/isInSystemContacts.std.js';

describe('isInSystemContacts', () => {
  it('returns true for direct conversations that have a `name` property', () => {
    assert.isTrue(
      isInSystemContacts({
        type: 'direct',
        name: 'Jane Doe',
      })
    );
    assert.isTrue(
      isInSystemContacts({
        type: 'private',
        name: 'Jane Doe',
      })
    );
  });

  it('returns true for direct conversations that have an empty string `name`', () => {
    assert.isTrue(
      isInSystemContacts({
        type: 'direct',
        name: '',
      })
    );
  });

  it('returns false for direct conversations that lack a `name` property', () => {
    assert.isFalse(isInSystemContacts({ type: 'direct' }));
  });

  it('returns false for group conversations', () => {
    assert.isFalse(isInSystemContacts({ type: 'group' }));
    assert.isFalse(
      isInSystemContacts({
        type: 'group',
        name: 'Tahoe Trip',
      })
    );
  });
});
