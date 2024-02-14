// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import * as Username from '../../util/Username';

describe('Username', () => {
  describe('getUsernameFromSearch', () => {
    const { getUsernameFromSearch } = Username;

    it('matches invalid username searches', () => {
      assert.isUndefined(getUsernameFromSearch('us'));
      assert.isUndefined(getUsernameFromSearch('123'));
    });

    it('matches partial username searches without discriminator', () => {
      assert.strictEqual(getUsernameFromSearch('use'), 'use');
      assert.strictEqual(getUsernameFromSearch('use.'), 'use.');
    });

    it('matches valid username searches', () => {
      assert.strictEqual(getUsernameFromSearch('username.12'), 'username.12');
      assert.strictEqual(getUsernameFromSearch('xyz.568'), 'xyz.568');
    });

    it('does not match something that looks like a phone number', () => {
      assert.isUndefined(getUsernameFromSearch('+'));
      assert.isUndefined(getUsernameFromSearch('2223'));
      assert.isUndefined(getUsernameFromSearch('+3'));
      assert.isUndefined(getUsernameFromSearch('+234234234233'));
    });
  });
});
