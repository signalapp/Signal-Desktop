// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import * as Username from '../../util/Username';

describe('Username', () => {
  describe('isValidUsername', () => {
    const { isValidUsername } = Username;

    it('does not match invalid username searches', () => {
      assert.isFalse(isValidUsername('username!'));
      assert.isFalse(isValidUsername('1username'));
      assert.isFalse(isValidUsername('u'));
      assert.isFalse(isValidUsername('username9012345678901234567890123'));
      assert.isFalse(isValidUsername('username.abc'));
    });

    it('matches valid usernames', () => {
      assert.isTrue(isValidUsername('username_34'));
      assert.isTrue(isValidUsername('u5ername'));
      assert.isTrue(isValidUsername('_username'));
      assert.isTrue(isValidUsername('use'));
      assert.isTrue(isValidUsername('username901234567890123456789012'));
      assert.isTrue(isValidUsername('username.0123'));
    });

    it('does not match valid and invalid usernames with @ prefix or suffix', () => {
      assert.isFalse(isValidUsername('@username_34'));
      assert.isFalse(isValidUsername('@1username'));
      assert.isFalse(isValidUsername('username_34@'));
      assert.isFalse(isValidUsername('1username@'));
    });
  });
});
