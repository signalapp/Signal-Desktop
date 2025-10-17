// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { _urlToPath } from '../../../app/protocol_filter.node.js';

describe('Protocol Filter', () => {
  describe('_urlToPath', () => {
    it('returns proper file path for unix style file URI with querystring', () => {
      const path =
        'file:///Users/someone/Development/signal/electron/background.html?name=Signal&locale=en&version=2.4.0';
      const expected =
        '/Users/someone/Development/signal/electron/background.html';

      const actual = _urlToPath(path);
      assert.strictEqual(actual, expected);
    });

    it('returns proper file path for file URI on windows', () => {
      const path =
        'file:///C:/Users/Someone/dev/desktop/background.html?name=Signal&locale=en&version=2.4.0';
      const expected = 'C:/Users/Someone/dev/desktop/background.html';
      const isWindows = true;

      const actual = _urlToPath(path, { isWindows });
      assert.strictEqual(actual, expected);
    });

    it('translates from URL format to filesystem format', () => {
      const path =
        'file:///Users/someone/Development%20Files/signal/electron/background.html';
      const expected =
        '/Users/someone/Development Files/signal/electron/background.html';

      const actual = _urlToPath(path);
      assert.strictEqual(actual, expected);
    });

    it('handles UNC path', () => {
      const path = '//share/path';
      const expected = '//share/path';

      const actual = _urlToPath(path);
      assert.strictEqual(actual, expected);
    });

    it('handles UNC path on windows', () => {
      const path = '//share/path';
      const expected = '//share/path';
      const isWindows = true;

      const actual = _urlToPath(path, { isWindows });
      assert.strictEqual(actual, expected);
    });

    it('handles simple relative path', () => {
      const path = 'file://relative/path';
      const expected = 'relative/path';

      const actual = _urlToPath(path);
      assert.strictEqual(actual, expected);
    });

    it('handles simple relative path on Windows', () => {
      const path = 'file://relative/path';
      const expected = 'elative/path';
      const isWindows = true;

      const actual = _urlToPath(path, { isWindows });
      assert.strictEqual(actual, expected);
    });

    it('hands back a path with .. in it', () => {
      const path = 'file://../../..';
      const expected = '../../..';

      const actual = _urlToPath(path);
      assert.strictEqual(actual, expected);
    });
  });
});
