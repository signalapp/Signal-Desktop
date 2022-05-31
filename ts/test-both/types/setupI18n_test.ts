// Copyright 2017-2022 Signal Messenger, LLC
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
  });

  describe('getLocale', () => {
    it('returns a string with length two or greater', () => {
      const locale = i18n.getLocale();
      assert.isAtLeast(locale.trim().length, 2);
    });
  });
});
