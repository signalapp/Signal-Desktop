// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert } from 'chai';
import * as moment from 'moment';
import { setupI18n } from '../../util/setupI18n';
import { DurationInSeconds } from '../../util/durations';
import type { LocaleMessagesType } from '../../types/I18N';

import * as expirationTimer from '../../util/expirationTimer';

function loadMessages(locale: string): LocaleMessagesType {
  const localePath = join(
    __dirname,
    '..',
    '..',
    '..',
    '_locales',
    locale,
    'messages.json'
  );
  const json = readFileSync(localePath, 'utf8');
  return JSON.parse(json) as LocaleMessagesType;
}

describe('expiration timer utilities', async () => {
  const enMessages = loadMessages('en');
  const i18n = setupI18n('en', enMessages);

  describe('DEFAULT_DURATIONS_IN_SECONDS', () => {
    const { DEFAULT_DURATIONS_IN_SECONDS } = expirationTimer;

    it('includes at least 3 durations', () => {
      assert.isAtLeast(DEFAULT_DURATIONS_IN_SECONDS.length, 3);
    });

    it('includes 1 hour as seconds', () => {
      const oneHour = DurationInSeconds.fromHours(1);
      assert.include(DEFAULT_DURATIONS_IN_SECONDS, oneHour);
    });
  });

  describe('format', () => {
    const { format } = expirationTimer;

    it('handles an undefined duration', () => {
      assert.strictEqual(format(i18n, undefined), 'off');
    });

    it('handles no duration', () => {
      assert.strictEqual(format(i18n, DurationInSeconds.ZERO), 'off');
    });

    it('formats durations', () => {
      new Map<number, string>([
        [1, '1 second'],
        [2, '2 seconds'],
        [30, '30 seconds'],
        [59, '59 seconds'],
        [moment.duration(1, 'm').asSeconds(), '1 minute'],
        [moment.duration(5, 'm').asSeconds(), '5 minutes'],
        [moment.duration(1, 'h').asSeconds(), '1 hour'],
        [moment.duration(8, 'h').asSeconds(), '8 hours'],
        [moment.duration(1, 'd').asSeconds(), '1 day'],
        [moment.duration(6, 'd').asSeconds(), '6 days'],
        [moment.duration(8, 'd').asSeconds(), '8 days'],
        [moment.duration(30, 'd').asSeconds(), '30 days'],
        [moment.duration(365, 'd').asSeconds(), '365 days'],
        [moment.duration(1, 'w').asSeconds(), '1 week'],
        [moment.duration(3, 'w').asSeconds(), '3 weeks'],
        [moment.duration(52, 'w').asSeconds(), '52 weeks'],
      ]).forEach((expected, input) => {
        assert.strictEqual(
          format(i18n, DurationInSeconds.fromSeconds(input)),
          expected
        );
      });
    });

    it('formats other languages successfully', () => {
      const esMessages = loadMessages('es');
      const esI18n = setupI18n('es', esMessages);
      assert.strictEqual(
        format(esI18n, DurationInSeconds.fromSeconds(120)),
        '2 minutos'
      );

      const zhCnMessages = loadMessages('zh-CN');
      const zhCnI18n = setupI18n('zh-CN', zhCnMessages);
      assert.strictEqual(
        format(zhCnI18n, DurationInSeconds.fromSeconds(60)),
        '1 分钟'
      );

      // The underlying library supports the "pt" locale, not the "pt_BR" locale. That's
      //   what we're testing here.
      const ptBrMessages = loadMessages('pt-BR');
      const ptBrI18n = setupI18n('pt_BR', ptBrMessages);
      assert.strictEqual(
        format(ptBrI18n, DurationInSeconds.fromDays(5)),
        '5 dias'
      );

      // The underlying library supports the Norwegian language, which is a macrolanguage
      //   for Bokmål and Nynorsk.
      const nbMessages = loadMessages('nb');
      const nlMessages = loadMessages('nl');
      [setupI18n('nb', nbMessages), setupI18n('nn', nlMessages)].forEach(
        norwegianI18n => {
          assert.strictEqual(
            format(norwegianI18n, DurationInSeconds.fromHours(6)),
            '6 timer'
          );
        }
      );
    });

    it('falls back to English if the locale is not supported', () => {
      const badI18n = setupI18n('bogus', {});
      assert.strictEqual(
        format(badI18n, DurationInSeconds.fromSeconds(120)),
        '2 minutes'
      );
    });

    it('handles a "mix" of units gracefully', () => {
      // We don't expect there to be a "mix" of units, but we shouldn't choke if a bad
      //   client gives us an unexpected timestamp.
      const mix = DurationInSeconds.fromSeconds(
        moment.duration(6, 'days').add(moment.duration(2, 'hours')).asSeconds()
      );
      assert.strictEqual(format(i18n, mix), '6 days, 2 hours');
    });

    it('handles negative numbers gracefully', () => {
      // The proto helps enforce non-negative numbers by specifying a u32, but because
      //   JavaScript lacks such a type, we test it here.
      assert.strictEqual(
        format(i18n, DurationInSeconds.fromSeconds(-1)),
        '1 second'
      );
      assert.strictEqual(
        format(i18n, DurationInSeconds.fromSeconds(-120)),
        '2 minutes'
      );
      assert.strictEqual(
        format(i18n, DurationInSeconds.fromSeconds(-0)),
        'off'
      );
    });

    it('handles fractional seconds gracefully', () => {
      // The proto helps enforce integer numbers by specifying a u32, but this function
      //   shouldn't choke if bad data is passed somehow.
      assert.strictEqual(
        format(i18n, DurationInSeconds.fromSeconds(4.2)),
        '4 seconds'
      );
      assert.strictEqual(
        format(i18n, DurationInSeconds.fromSeconds(4.8)),
        '4 seconds'
      );
      assert.strictEqual(
        format(i18n, DurationInSeconds.fromSeconds(0.2)),
        '1 second'
      );
      assert.strictEqual(
        format(i18n, DurationInSeconds.fromSeconds(0.8)),
        '1 second'
      );

      // If multiple things go wrong and we pass a fractional negative number, we still
      //   shouldn't explode.
      assert.strictEqual(
        format(i18n, DurationInSeconds.fromSeconds(-4.2)),
        '4 seconds'
      );
      assert.strictEqual(
        format(i18n, DurationInSeconds.fromSeconds(-4.8)),
        '4 seconds'
      );
      assert.strictEqual(
        format(i18n, DurationInSeconds.fromSeconds(-0.2)),
        '1 second'
      );
      assert.strictEqual(
        format(i18n, DurationInSeconds.fromSeconds(-0.8)),
        '1 second'
      );
    });
  });
});
