// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import * as Username from '../../util/Username';

describe('Username', () => {
  describe('getUsernameFromSearch', () => {
    const { getUsernameFromSearch } = Username;

    it('matches partial username searches without discriminator', () => {
      assert.strictEqual(getUsernameFromSearch('u'), 'u.01');
      assert.strictEqual(getUsernameFromSearch('us'), 'us.01');
      assert.strictEqual(getUsernameFromSearch('use'), 'use.01');
      assert.strictEqual(getUsernameFromSearch('use.'), 'use.01');
    });

    it('matches and strips leading @', () => {
      assert.strictEqual(getUsernameFromSearch('@user'), 'user.01');
      assert.strictEqual(getUsernameFromSearch('@user.'), 'user.01');
      assert.strictEqual(getUsernameFromSearch('@user.01'), 'user.01');
    });

    it('adds a 1 if discriminator is one digit', () => {
      assert.strictEqual(getUsernameFromSearch('@user.0'), 'user.01');
      assert.strictEqual(getUsernameFromSearch('@user.2'), 'user.21');
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

  describe('probablyAUsername', () => {
    const { isProbablyAUsername: probablyAUsername } = Username;

    it('returns true if it starts with @', () => {
      assert.isTrue(probablyAUsername('@'));
      assert.isTrue(probablyAUsername('@5551115555'));
      assert.isTrue(probablyAUsername('@.324'));
    });

    it('returns true if it ends with a discriminator', () => {
      assert.isTrue(probablyAUsername('someone.00'));
      assert.isTrue(probablyAUsername('32423423.04'));
      assert.isTrue(probablyAUsername('d.04'));
    });

    it('returns false if just a discriminator', () => {
      assert.isFalse(probablyAUsername('.01'));
      assert.isFalse(probablyAUsername('.99'));
    });

    it('returns false for normal searches', () => {
      assert.isFalse(probablyAUsername('group'));
      assert.isFalse(probablyAUsername('climbers'));
      assert.isFalse(probablyAUsername('sarah'));
      assert.isFalse(probablyAUsername('john'));
    });

    it('returns false for something that looks like a phone number', () => {
      assert.isFalse(probablyAUsername('+'));
      assert.isFalse(probablyAUsername('2223'));
      assert.isFalse(probablyAUsername('+3'));
      assert.isFalse(probablyAUsername('+234234234233'));
    });
  });
});
