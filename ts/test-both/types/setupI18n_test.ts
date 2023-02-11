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
    it('returns empty string for unknown string', () => {
      // eslint-disable-next-line local-rules/valid-i18n-keys
      assert.strictEqual(i18n('random'), '');
    });
    it('returns message for given string', () => {
      assert.strictEqual(i18n('reportIssue'), 'Contact Support');
    });
    it('returns message with single substitution', () => {
      const actual = i18n('migratingToSQLCipher', ['45/200']);
      assert.equal(actual, 'Optimizing messages... 45/200 complete.');
    });
    it('returns message with multiple substitutions', () => {
      const actual = i18n('theyChangedTheTimer', {
        name: 'Someone',
        time: '5 minutes',
      });
      assert.equal(
        actual,
        'Someone set the disappearing message time to 5 minutes.'
      );
    });
    it('returns a modern icu message formatted', () => {
      const actual = i18n('icu:ProfileEditor--info', {
        learnMore: 'LEARN MORE',
      });
      assert.equal(
        actual,
        'Your profile is encrypted. Your profile and changes to it will be visible to your contacts and when you start or accept new chats. LEARN MORE'
      );
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
        { id: 'icu:emptyInboxMessage' },
        { composeIcon: 'ICONIC' }
      );
      assert.equal(
        result,
        'Click the ICONIC above and search for your contacts or groups to message.'
      );
    });
  });

  describe('isLegacyFormat', () => {
    it('returns false for new format', () => {
      assert.isFalse(i18n.isLegacyFormat('icu:ProfileEditor--info'));
      assert.isTrue(i18n.isLegacyFormat('softwareAcknowledgments'));
    });
  });
});
