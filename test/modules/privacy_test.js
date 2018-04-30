const path = require('path');

const { assert } = require('chai');

const Privacy = require('../../js/modules/privacy');

const APP_ROOT_PATH = path.join(__dirname, '..', '..', '..');

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
        'group2 group(abcdefghij) doloret\n';

      const actual = Privacy.redactAll(text);
      const expected =
        'This is a log line with sensitive information:\n' +
        'path1 [REDACTED]/main.js\n' +
        'phone1 +[REDACTED]455 ipsum\n' +
        'group1 group([REDACTED]789) doloret\n' +
        'path2 file:///[REDACTED]/js/background.js.' +
        'phone2 +[REDACTED]566 lorem\n' +
        'group2 group([REDACTED]hij) doloret\n';
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
        'path2 file:///[REDACTED]/js/background.js.';
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
