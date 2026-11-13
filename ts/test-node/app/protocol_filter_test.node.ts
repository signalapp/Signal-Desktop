// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assert } from 'chai';
import type { ProtocolResponse } from 'electron';
import * as sinon from 'sinon';

import {
  _createFileHandler,
  _urlToPath,
  type FileHandlerType,
} from '../../../app/protocol_filter.node.ts';

describe('Protocol Filter', () => {
  beforeEach(function (this: Mocha.Context) {
    this.sandbox = sinon.createSandbox();
  });

  afterEach(function (this: Mocha.Context) {
    this.sandbox.restore();
  });

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

  describe('_createFileHandler', () => {
    function testFn({
      fileHandler,
      url,
      expectedResult,
    }: {
      fileHandler: FileHandlerType;
      url: string;
      expectedResult: string | Partial<ProtocolResponse>;
    }) {
      const testCallback = sinon.stub();

      const request = {
        headers: {},
        method: 'GET',
        referrer: '',
        url,
      };
      fileHandler(request, testCallback);
      sinon.assert.calledWithMatch(testCallback, expectedResult);
    }

    describe('windows', () => {
      before(function (this: Mocha.Context) {
        if (process.platform !== 'win32') {
          this.skip();
        }
      });

      function getFileHandler(): FileHandlerType {
        return _createFileHandler({
          userDataPath: 'C:\\Users\\signaluser\\AppData\\Roaming\\Signal',
          unresolvedUserDataPath:
            'C:\\Users\\signaluser\\AppData\\Roaming\\Signal',
          installPath:
            'C:\\Users\\signaluser\\AppData\\Local\\Programs\\signal-desktop',
          unresolvedInstallPath:
            'C:\\Users\\signaluser\\AppData\\Local\\Programs\\signal-desktop',
          isWindows: true,
        });
      }

      it('allows files in userData', () => {
        testFn({
          fileHandler: getFileHandler(),
          url: 'file:///C:/Users/signaluser/AppData/Roaming/Signal/foo',
          expectedResult: {
            path: 'C:\\Users\\signaluser\\AppData\\Roaming\\Signal\\foo',
          },
        });
      });

      it('disallows files in other places', () => {
        const fileHandler = getFileHandler();

        testFn({
          fileHandler,
          url: 'file:///C:/Windows/foo',
          expectedResult: { error: -10 },
        });
        testFn({
          fileHandler,
          url: 'file:///C:/Users/signaluser/AppData/Roaming/Signal Beta/foo',
          expectedResult: { error: -10 },
        });
      });

      it('disallows UNC paths outside allowed roots', () => {
        const fileHandler = getFileHandler();

        testFn({
          fileHandler,
          url: 'file:///%5C%5Cattacker.invalid%5Cshare%5Cfoo',
          expectedResult: { error: -10 },
        });
        testFn({
          fileHandler,
          url: 'file:///%2F%2Fattacker.invalid%2Fshare%2Ffoo',
          expectedResult: { error: -10 },
        });
      });
    });

    describe('macos', () => {
      before(function (this: Mocha.Context) {
        if (process.platform === 'win32') {
          this.skip();
        }
      });

      function getFileHandler(): FileHandlerType {
        return _createFileHandler({
          userDataPath: '/Users/signaluser/Library/Application Support/Signal',
          unresolvedUserDataPath:
            '/Users/signaluser/Library/Application Support/Signal',
          installPath: '/Applications/Signal',
          unresolvedInstallPath: '/Applications/Signal',
          isWindows: false,
        });
      }

      it('allows files in userData', () => {
        testFn({
          fileHandler: getFileHandler(),
          url: 'file:///Users/signaluser/Library/Application Support/Signal/foo',
          expectedResult: {
            path: '/Users/signaluser/Library/Application Support/Signal/foo',
          },
        });
      });

      it('disallows files in other places', () => {
        const fileHandler = getFileHandler();

        testFn({
          fileHandler,
          url: 'file:///Applications/foo',
          expectedResult: { error: -10 },
        });
        testFn({
          fileHandler,
          url: 'file:///Users/signaluser/Library/Application Support/Signal Beta/foo',
          expectedResult: { error: -10 },
        });
      });
    });

    describe('linux', () => {
      before(function (this: Mocha.Context) {
        if (process.platform === 'win32') {
          this.skip();
        }
      });

      function getFileHandler(): FileHandlerType {
        return _createFileHandler({
          userDataPath: '/home/signaluser/.config/Signal',
          unresolvedUserDataPath: '/home/signaluser/.config/Signal',
          installPath: '/usr/bin/signal-desktop',
          unresolvedInstallPath: '/usr/bin/signal-desktop',
          isWindows: false,
        });
      }

      it('allows files in userData', () => {
        testFn({
          fileHandler: getFileHandler(),
          url: 'file:///home/signaluser/.config/Signal/foo',
          expectedResult: { path: '/home/signaluser/.config/Signal/foo' },
        });
      });

      it('disallows files in other places', () => {
        const fileHandler = getFileHandler();

        testFn({
          fileHandler,
          url: 'file:///usr/bin/foo',
          expectedResult: { error: -10 },
        });
        testFn({
          fileHandler,
          url: 'file:///home/signaluser/.config/Signal Beta/foo',
          expectedResult: { error: -10 },
        });
      });
    });

    describe('symlinks', () => {
      const isWindows = process.platform === 'win32';
      let tempDir: string;

      function symlink({ to, from }: { to: string; from: string }): void {
        symlinkSync(to, from, 'junction');
      }

      beforeEach(() => {
        tempDir = realpathSync(mkdtempSync(join(tmpdir(), 'protocol-filter-')));
        mkdirSync(join(tempDir, 'user-data'));
        mkdirSync(join(tempDir, 'install'));
        mkdirSync(join(tempDir, 'outside'));
        writeFileSync(join(tempDir, 'user-data', 'foo'), '');
        writeFileSync(join(tempDir, 'outside', 'secret'), '');
        symlink({
          to: join(tempDir, 'user-data'),
          from: join(tempDir, 'symlinked-user-data'),
        });
      });

      afterEach(() => {
        rmSync(tempDir, { recursive: true, force: true });
      });

      function getFileHandler(): FileHandlerType {
        return _createFileHandler({
          userDataPath: join(tempDir, 'user-data'),
          unresolvedUserDataPath: join(tempDir, 'symlinked-user-data'),
          installPath: join(tempDir, 'install'),
          unresolvedInstallPath: join(tempDir, 'install'),
          isWindows,
        });
      }

      it('allows files requested through a symlinked userData', () => {
        testFn({
          fileHandler: getFileHandler(),
          url: pathToFileURL(join(tempDir, 'symlinked-user-data', 'foo')).href,
          expectedResult: {
            path: realpathSync(join(tempDir, 'user-data', 'foo')),
          },
        });
      });

      it('disallows symlinks inside userData that point outside', () => {
        symlink({
          to: join(tempDir, 'outside'),
          from: join(tempDir, 'user-data', 'escape'),
        });

        testFn({
          fileHandler: getFileHandler(),
          url: pathToFileURL(join(tempDir, 'user-data', 'escape', 'secret'))
            .href,
          expectedResult: { error: -10 },
        });
      });

      it('disallows paths outside allowed roots before resolving them', () => {
        symlink({
          to: join(tempDir, 'user-data'),
          from: join(tempDir, 'outside', 'link-in'),
        });

        testFn({
          fileHandler: getFileHandler(),
          url: pathToFileURL(join(tempDir, 'outside', 'link-in', 'foo')).href,
          expectedResult: { error: -10 },
        });
      });
    });
  });
});
