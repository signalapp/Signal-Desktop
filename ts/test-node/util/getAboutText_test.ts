// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import enMessages from '../../../_locales/en/messages.json';
import { getAboutText } from '../../util/getAboutText';
import { setupI18n } from '../../util/setupI18n';

const i18n = setupI18n('en', enMessages);

describe('getAboutText', () => {
  it('returns undefined when there is no text', () => {
    assert.isUndefined(getAboutText({}, i18n));
  });

  it('returns text when there is text, but not emoji', () => {
    assert.strictEqual(
      getAboutText(
        {
          about: 'hello',
        },
        i18n
      ),
      'hello'
    );
  });

  it('returns text and emoji', () => {
    assert.strictEqual(
      getAboutText(
        {
          about: 'hello',
          aboutEmoji: '😁',
        },
        i18n
      ),
      '😁 hello'
    );
  });

  it('simplifies text', () => {
    assert.strictEqual(
      getAboutText(
        {
          about: '✓✔☑√⛉⛊⛛hello',
        },
        i18n
      ),
      'hello'
    );
  });
});
