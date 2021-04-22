const path = require('path');

const { assert } = require('chai');

const Privacy = require('../../js/modules/privacy');

const APP_ROOT_PATH = path.join(__dirname, '..', '..', '..');

describe('Privacy', () => {
  describe('redactSessionID', () => {
    it('should redact all session IDs', () => {
      const text =
        'This is a log line with a session ID 0531032fc7415b7cc1b7516480ad121d391eddce3cfb2cee27dd5b215609c32827 and another one 05766049a70e725ad02f7fe61b10e461380a4d7433f98096b3cacbf0362d5cab62';

      const actual = Privacy.redactSessionID(text);
      const expected = 'This is a log line with a session ID [REDACTED] and another one [REDACTED]';
      assert.equal(actual, expected);
    });

    it('should not redact non session IDS', () => {
      const text =
        'This is a log line with a non-session ID sadsad0531032fc7415b7cc1b7516480ad121d391eddce3cfb2cee27dd5b215609c32827888 and another one 766049a70e725ad02f7fe61b10e461380a4d7433f98096b3cacbf0362d5cab6234';

      const actual = Privacy.redactSessionID(text);
      assert.equal(actual, text);
    });
  });

  describe('redactGroupIds', () => {
    it('should redact all group IDs', () => {
      const text = 'This is a log line with two group IDs: group(123456789) and group(abcdefghij)';

      const actual = Privacy.redactGroupIds(text);
      const expected =
        'This is a log line with two group IDs: group([REDACTED]789) and group([REDACTED]hij)';
      assert.equal(actual, expected);
    });

    it('should remove newlines from redacted group IDs', () => {
      const text =
        'This is a log line with two group IDs: group(12345678\n9)\nand group(abc\ndefghij)';

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
        'phone1 0531032fc7415b7cc1b7516480ad121d391eddce3cfb2cee27dd5b215609c32827 ipsum\n' +
        'group 31032fc7415b7cc1b7516480ad121d391eddce3cfb2cee27dd5b215609c32827 eeee\n' +
        'group1 group(123456789) doloret\n' +
        `path2 file:///${encodedAppRootPath}/js/background.js.` +
        'phone2 0531033dc7415b7cc1b7516480ad121d391eddce3cfb2cee27dd5b215609c32827 lorem\n' +
        'group2 group(abcdefghij) doloret\n' +
        'url1 https://you-have-to-hide.me aaa\n' +
        'url1 http://you-have-to-hide.me bbb\n' +
        'url1 127.0.0.1:22021 ccc\n';

      const actual = Privacy.redactAll(text);
      const expected =
        'This is a log line with sensitive information:\n' +
        'path1 [REDACTED]/main.js\n' +
        'phone1 [REDACTED] ipsum\n' +
        'group [REDACTED] eeee\n' +
        'group1 group([REDACTED]789) doloret\n' +
        'path2 file:///[REDACTED]/js/background.js.' +
        'phone2 [REDACTED] lorem\n' +
        'group2 group([REDACTED]hij) doloret\n' +
        'url1 [REDACTED] aaa\n' +
        'url1 [REDACTED] bbb\n' +
        'url1 [REDACTED]:22021 ccc\n';
      assert.equal(actual, expected);
    });
  });

  describe('_redactPath', () => {
    it('should redact file paths', () => {
      const testPath = '/Users/meow/Library/Application Support/Signal Beta';
      const text =
        'This is a log line with sensitive information:\n' +
        `path1 ${testPath}/main.js\n` +
        'phone1 0531032fc7415b7cc1b7516480ad121d391eddce3cfb2cee27dd5b215609c32827 ipsum\n';

      const actual = Privacy._redactPath(testPath)(text);
      const expected =
        'This is a log line with sensitive information:\n' +
        'path1 [REDACTED]/main.js\n' +
        'phone1 0531032fc7415b7cc1b7516480ad121d391eddce3cfb2cee27dd5b215609c32827 ipsum\n';
      assert.equal(actual, expected);
    });

    it('should redact URL-encoded paths', () => {
      const testPath = '/Users/meow/Library/Application Support/Signal Beta';
      const encodedTestPath = encodeURI(testPath);
      const text =
        'This is a log line with sensitive information:\n' +
        `path1 ${testPath}/main.js\n` +
        'phone1 0531032fc7415b7cc1b7516480ad121d391eddce3cfb2cee27dd5b215609c32827 ipsum\n' +
        'group1 group(123456789) doloret\n' +
        `path2 file:///${encodedTestPath}/js/background.js.`;

      const actual = Privacy._redactPath(testPath)(text);
      const expected =
        'This is a log line with sensitive information:\n' +
        'path1 [REDACTED]/main.js\n' +
        'phone1 0531032fc7415b7cc1b7516480ad121d391eddce3cfb2cee27dd5b215609c32827 ipsum\n' +
        'group1 group(123456789) doloret\n' +
        'path2 file:///[REDACTED]/js/background.js.';
      assert.equal(actual, expected);
    });

    it('should redact stack traces with both forward and backslashes', () => {
      const testPath = 'C:/Users/Meow/AppData/Local/Programs/loki-messenger-beta';
      const modifiedTestPath = 'C:\\Users\\Meow\\AppData\\Local\\Programs\\loki-messenger-beta';
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
      const testPath = 'C:\\Users\\Meow\\AppData\\Local\\Programs\\loki-messenger-beta';
      const modifiedTestPath =
        'C:\\\\Users\\\\Meow\\\\AppData\\\\Local\\\\Programs\\\\loki-messenger-beta';
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
