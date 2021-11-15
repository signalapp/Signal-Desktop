// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import * as Username from '../../types/Username';

describe('Username', () => {
  describe('getUsernameFromSearch', () => {
    const { getUsernameFromSearch } = Username;

    it('matches invalid username searches', () => {
      assert.strictEqual(getUsernameFromSearch('username!'), 'username!');
      assert.strictEqual(getUsernameFromSearch('1username'), '1username');
      assert.strictEqual(getUsernameFromSearch('use'), 'use');
      assert.strictEqual(
        getUsernameFromSearch('username9012345678901234567'),
        'username9012345678901234567'
      );
    });

    it('matches valid username searches', () => {
      assert.strictEqual(getUsernameFromSearch('username_34'), 'username_34');
      assert.strictEqual(getUsernameFromSearch('u5ername'), 'u5ername');
      assert.strictEqual(getUsernameFromSearch('user'), 'user');
      assert.strictEqual(
        getUsernameFromSearch('username901234567890123456'),
        'username901234567890123456'
      );
    });

    it('matches valid and invalid usernames with @ prefix', () => {
      assert.strictEqual(getUsernameFromSearch('@username!'), 'username!');
      assert.strictEqual(getUsernameFromSearch('@1username'), '1username');
      assert.strictEqual(getUsernameFromSearch('@username_34'), 'username_34');
      assert.strictEqual(getUsernameFromSearch('@u5ername'), 'u5ername');
    });

    it('matches valid and invalid usernames with @ suffix', () => {
      assert.strictEqual(getUsernameFromSearch('username!@'), 'username!');
      assert.strictEqual(getUsernameFromSearch('1username@'), '1username');
      assert.strictEqual(getUsernameFromSearch('username_34@'), 'username_34');
      assert.strictEqual(getUsernameFromSearch('u5ername@'), 'u5ername');
    });

    it('does not match something that looks like a phone number', () => {
      assert.isUndefined(getUsernameFromSearch('+'));
      assert.isUndefined(getUsernameFromSearch('2223'));
      assert.isUndefined(getUsernameFromSearch('+3'));
      assert.isUndefined(getUsernameFromSearch('+234234234233'));
    });
  });

  describe('isValidUsername', () => {
    const { isValidUsername } = Username;

    it('does not match invalid username searches', () => {
      assert.isFalse(isValidUsername('username!'));
      assert.isFalse(isValidUsername('1username'));
      assert.isFalse(isValidUsername('use'));
      assert.isFalse(isValidUsername('username9012345678901234567'));
    });

    it('matches valid usernames', () => {
      assert.isTrue(isValidUsername('username_34'));
      assert.isTrue(isValidUsername('u5ername'));
      assert.isTrue(isValidUsername('_username'));
      assert.isTrue(isValidUsername('user'));
      assert.isTrue(isValidUsername('username901234567890123456'));
    });

    it('does not match valid and invalid usernames with @ prefix or suffix', () => {
      assert.isFalse(isValidUsername('@username_34'));
      assert.isFalse(isValidUsername('@1username'));
      assert.isFalse(isValidUsername('username_34@'));
      assert.isFalse(isValidUsername('1username@'));
    });
  });
});
