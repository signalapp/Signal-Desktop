// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import * as Privacy from '../../util/privacy';
import { APP_ROOT_PATH } from '../../util/privacy';

Privacy.addSensitivePath('sensitive-path');

describe('Privacy', () => {
  describe('redactPhoneNumbers', () => {
    it('should redact all phone numbers', () => {
      const text =
        'This is a log line with a phone number +12223334455\n' +
        'and another one +13334445566';

      const actual = Privacy.redactPhoneNumbers(text);
      const expected =
        'This is a log line with a phone number +[REDACTED]455\n' +
        'and another one +[REDACTED]566';
      assert.equal(actual, expected);
    });
  });

  describe('redactUuids', () => {
    it('should redact all uuids', () => {
      const text =
        'This is a log line with a uuid 9e420799-acdf-4bf4-8dee-353d7e2096b4\n' +
        'and another one IN ALL UPPERCASE 340727FB-E43A-413B-941B-AADA033B6CA3';

      const actual = Privacy.redactUuids(text);
      const expected =
        'This is a log line with a uuid [REDACTED]6b4\n' +
        'and another one IN ALL UPPERCASE [REDACTED]CA3';
      assert.equal(actual, expected);
    });
  });

  describe('redactGroupIds', () => {
    it('should redact all group IDs', () => {
      const text =
        'This is a log line with two group IDs: group(123456789)\n' +
        'and group(abcdefghij)';

      const actual = Privacy.redactGroupIds(text);
      const expected =
        'This is a log line with two group IDs: group([REDACTED]789)\n' +
        'and group([REDACTED]hij)';
      assert.equal(actual, expected);
    });

    it('should remove newlines from redacted group IDs', () => {
      const text =
        'This is a log line with two group IDs: group(12345678\n9)\n' +
        'and group(abc\ndefghij)';

      const actual = Privacy.redactGroupIds(text);
      const expected =
        'This is a log line with two group IDs: group([REDACTED]789)\n' +
        'and group([REDACTED]hij)';
      assert.equal(actual, expected);
    });

    it('should remove newlines from redacted group V2 IDs', () => {
      const text =
        'This is a log line with three group IDs: groupv2(abcd32341a==)\n' +
        'and groupv2(abcd32341ad=) and and groupv2(abcd32341ade)';

      const actual = Privacy.redactGroupIds(text);
      const expected =
        'This is a log line with three group IDs: groupv2([REDACTED]41a==)\n' +
        'and groupv2([REDACTED]1ad=) and and groupv2([REDACTED]ade)';
      assert.equal(actual, expected);
    });
  });

  describe('redactCallLinkRoomIds', () => {
    it('should redact call link room IDs', () => {
      const text =
        'Log line with call link room ID 7f3d431d4512b30754915a262db43cd789f799d710525a83429d48aee8c2cd4b\n' +
        'and another IN ALL UPPERCASE 7F3D431D4512B30754915A262DB43CD789F799D710525A83429D48AEE8C2CD4B';

      const actual = Privacy.redactCallLinkRoomIds(text);
      const expected =
        'Log line with call link room ID [REDACTED]d4b\n' +
        'and another IN ALL UPPERCASE [REDACTED]D4B';
      assert.equal(actual, expected);
    });
  });

  describe('redactCallLinkRootKeys', () => {
    it('should redact call link root keys', () => {
      const text =
        'Log line with call link https://signal.link/call/#key=hktt-kskq-dhcn-bgkm-hbbg-qqkq-sfbp-czmc\n' +
        'and another IN ALL UPPERCASE HKTT-KSKQ-DHCN-BGKM-HBBG-QQKQ-SFBP-CZMC';

      const actual = Privacy.redactCallLinkRootKeys(text);
      const expected =
        'Log line with call link https://signal.link/call/#key=[REDACTED]hktt\n' +
        'and another IN ALL UPPERCASE [REDACTED]HKTT';
      assert.equal(actual, expected);
    });
  });

  describe('redactAll', () => {
    it('should redact all sensitive information', () => {
      const encodedAppRootPath = APP_ROOT_PATH.replace(/ /g, '%20');
      const text =
        'This is a log line with sensitive information:\n' +
        `path1 ${APP_ROOT_PATH}/main.js\n` +
        'phone1 +12223334455 ipsum\n' +
        'group1 group(123456789) doloret\n' +
        `path2 file:///${encodedAppRootPath}/js/background.js.` +
        'phone2 +13334445566 lorem\n' +
        'group2 group(abcdefghij) doloret\n' +
        'path3 sensitive-path/attachment.noindex\n';

      const actual = Privacy.redactAll(text);
      const expected =
        'This is a log line with sensitive information:\n' +
        'path1 [REDACTED]/main.js\n' +
        'phone1 +[REDACTED]455 ipsum\n' +
        'group1 group([REDACTED]789) doloret\n' +
        'path2 [REDACTED]/js/background.js.' +
        'phone2 +[REDACTED]566 lorem\n' +
        'group2 group([REDACTED]hij) doloret\n' +
        'path3 [REDACTED]/attachment.noindex\n';
      assert.equal(actual, expected);
    });
  });

  describe('_redactPath', () => {
    it('should redact file paths', () => {
      const testPath = '/Users/meow/Library/Application Support/Signal Beta';
      const text =
        'This is a log line with sensitive information:\n' +
        `path1 ${testPath}/main.js\n` +
        'phone1 +12223334455 ipsum\n';

      const actual = Privacy._redactPath(testPath)(text);
      const expected =
        'This is a log line with sensitive information:\n' +
        'path1 [REDACTED]/main.js\n' +
        'phone1 +12223334455 ipsum\n';
      assert.equal(actual, expected);
    });

    it('should redact URL-encoded paths', () => {
      const testPath = '/Users/meow/Library/Application Support/Signal Beta';
      const encodedTestPath = encodeURI(testPath);
      const text =
        'This is a log line with sensitive information:\n' +
        `path1 ${testPath}/main.js\n` +
        'phone1 +12223334455 ipsum\n' +
        'group1 group(123456789) doloret\n' +
        `path2 file:///${encodedTestPath}/js/background.js.`;

      const actual = Privacy._redactPath(testPath)(text);
      const expected =
        'This is a log line with sensitive information:\n' +
        'path1 [REDACTED]/main.js\n' +
        'phone1 +12223334455 ipsum\n' +
        'group1 group(123456789) doloret\n' +
        'path2 [REDACTED]/js/background.js.';
      assert.equal(actual, expected);
    });

    it('should redact stack traces with both forward and backslashes', () => {
      const testPath =
        'C:/Users/Meow/AppData/Local/Programs/signal-desktop-beta';
      const modifiedTestPath =
        'C:\\Users\\Meow\\AppData\\Local\\Programs\\signal-desktop-beta';
      const text =
        'This is a log line with sensitive information:\n' +
        `path1 ${testPath}\\main.js\n` +
        'phone1 +12223334455 ipsum\n' +
        'group1 group(123456789) doloret\n' +
        `path2 ${modifiedTestPath}\\js\\background.js.`;

      const actual = Privacy._redactPath(testPath)(text);
      const expected =
        'This is a log line with sensitive information:\n' +
        'path1 [REDACTED]\\main.js\n' +
        'phone1 +12223334455 ipsum\n' +
        'group1 group(123456789) doloret\n' +
        'path2 [REDACTED]\\js\\background.js.';
      assert.equal(actual, expected);
    });

    it('should redact stack traces with escaped backslashes', () => {
      const testPath =
        'C:\\Users\\Meow\\AppData\\Local\\Programs\\signal-desktop-beta';
      const modifiedTestPath =
        'C:\\\\Users\\\\Meow\\\\AppData\\\\Local\\\\Programs\\\\signal-desktop-beta';
      const text =
        'This is a log line with sensitive information:\n' +
        `path1 ${testPath}\\main.js\n` +
        'phone1 +12223334455 ipsum\n' +
        'group1 group(123456789) doloret\n' +
        `path2 ${modifiedTestPath}\\js\\background.js.`;

      const actual = Privacy._redactPath(testPath)(text);
      const expected =
        'This is a log line with sensitive information:\n' +
        'path1 [REDACTED]\\main.js\n' +
        'phone1 +12223334455 ipsum\n' +
        'group1 group(123456789) doloret\n' +
        'path2 [REDACTED]\\js\\background.js.';
      assert.equal(actual, expected);
    });
  });
});
