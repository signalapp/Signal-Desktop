// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type { LocalizerType } from '../../types/Util';
import { setupI18n } from '../../util/setupI18n';
import * as enMessages from '../../../_locales/en/messages.json';

describe('setupI18n', () => {
  let i18n: LocalizerType;

  beforeEach(() => {
    i18n = setupI18n('en', enMessages);
  });

  describe('i18n', () => {
    it('returns message for given string', () => {
      assert.strictEqual(i18n('icu:reportIssue'), 'Contact Support');
    });
    it('returns message with single substitution', () => {
      const actual = i18n('icu:ContactListItem__remove-system--title', {
        title: 'Alice',
      });
      assert.equal(actual, 'Unable to remove Alice');
    });
    it('returns message with multiple substitutions', () => {
      const actual = i18n('icu:theyChangedTheTimer', {
        name: 'Someone',
        time: '5 minutes',
      });
      assert.equal(
        actual,
        'Someone set the disappearing message time to 5 minutes.'
      );
    });
    it('returns a modern icu message formatted', () => {
      const actual = i18n(
        'icu:AddUserToAnotherGroupModal__toast--adding-user-to-group',
        { contact: 'CONTACT' }
      );
      assert.equal(actual, 'Adding CONTACT...');
    });
  });

  describe('getLocale', () => {
    it('returns a string with length two or greater', () => {
      const locale = i18n.getLocale();
      assert.isAtLeast(locale.trim().length, 2);
    });
  });

  describe('getIntl', () => {
    it('returns the intl object to call formatMessage()', () => {
      const intl = i18n.getIntl();
      assert.isObject(intl);
      const result = intl.formatMessage(
        { id: 'icu:contactAvatarAlt' },
        { name: 'NAME' }
      );
      assert.equal(result, 'Avatar for contact NAME');
    });
  });
});
