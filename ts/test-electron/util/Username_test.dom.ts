// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import * as Username from '../../util/Username.dom.js';

describe('Username', () => {
  describe('getUsernameFromSearch', () => {
    const { getUsernameFromSearch } = Username;

    it('matches partial username searches without discriminator', () => {
      assert.strictEqual(getUsernameFromSearch('use'), 'use.01');
      assert.strictEqual(getUsernameFromSearch('user'), 'user.01');
      assert.strictEqual(getUsernameFromSearch('usern'), 'usern.01');
      assert.strictEqual(getUsernameFromSearch('usern.'), 'usern.01');
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
      assert.strictEqual(getUsernameFromSearch('numbered9.34'), 'numbered9.34');
      assert.strictEqual(getUsernameFromSearch('u12.34'), 'u12.34');
      assert.strictEqual(
        getUsernameFromSearch('with_underscore.56'),
        'with_underscore.56'
      );
      assert.strictEqual(
        getUsernameFromSearch('username_with_32_characters_1234.45'),
        'username_with_32_characters_1234.45'
      );
    });

    it('trims whitespace at beginning or end', () => {
      assert.strictEqual(getUsernameFromSearch('  username.12'), 'username.12');
      assert.strictEqual(getUsernameFromSearch('xyz.568  '), 'xyz.568');
      assert.strictEqual(
        getUsernameFromSearch('\t\t  numbered9.34 \t\t '),
        'numbered9.34'
      );
    });

    it('does not match when then username starts with a number', () => {
      assert.isUndefined(getUsernameFromSearch('1user.12'));
      assert.isUndefined(getUsernameFromSearch('9user_name.12'));
    });

    it('does not match usernames shorter than 3 characters or longer than 32', () => {
      assert.isUndefined(getUsernameFromSearch('us.12'));
      assert.isUndefined(
        getUsernameFromSearch('username_with_33_characters_12345.67')
      );
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
      assert.isTrue(probablyAUsername('d2423423.04'));
      assert.isTrue(probablyAUsername('e_f.04'));
    });

    it('returns true if it starts or ends with whitespace', () => {
      assert.isTrue(probablyAUsername('  @user\t  '));
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

    it('returns false for usernames starting with a number', () => {
      assert.isFalse(probablyAUsername('1user.01'));
      assert.isFalse(probablyAUsername('9name.99'));
    });

    it('returns false for usernames shorter than 3 characters or longer than 32', () => {
      assert.isFalse(probablyAUsername('us.12'));
      assert.isFalse(probablyAUsername('username_with_33_characters_12345.67'));
    });

    it('returns false for something that looks like a phone number', () => {
      assert.isFalse(probablyAUsername('+'));
      assert.isFalse(probablyAUsername('2223'));
      assert.isFalse(probablyAUsername('+3'));
      assert.isFalse(probablyAUsername('+234234234233'));
    });
  });
});
