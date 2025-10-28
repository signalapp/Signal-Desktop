// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import fsExtra from 'fs-extra';
import { stat, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import {
  createUpdateCacheDirIfNeeded,
  getUpdateFileName,
  getVersion,
  isUpdateFileNameValid,
  validatePath,
  parseYaml,
  createTempDir,
  getTempDir,
  deleteTempDir,
} from '../../updater/common.main.js';
import { createLogger } from '../../logging/log.std.js';

const { pathExists } = fsExtra;

const log = createLogger('common_test');

describe('updater/signatures', () => {
  const windows = parseYaml(`version: 1.23.2
files:
  - url: signal-desktop-win-1.23.2.exe
    sha512: hhK+cVAb+QOK/Ln0RBcq8Rb1iPcUC0KZeT4NwLB25PMGoPmakY27XE1bXq4QlkASJN1EkYTbKf3oUJtcllziyQ==
    size: 92020776
path: signal-desktop-win-1.23.2.exe
sha512: hhK+cVAb+QOK/Ln0RBcq8Rb1iPcUC0KZeT4NwLB25PMGoPmakY27XE1bXq4QlkASJN1EkYTbKf3oUJtcllziyQ==
releaseDate: '2019-03-29T16:58:08.210Z'
`);
  const mac = parseYaml(`version: 1.23.2
files:
  - url: signal-desktop-mac-x64-1.23.2.zip
    sha512: STurwHhpE2rwwpwz3/RQBbMbVYY2Hh1DVpeofwIWPXoDTX/41zia+ByKXq8BvnjIMdQ3YmPHu+UppAW/+CFkFQ==
    size: 150317727
  - url: signal-desktop-mac-arm64-1.23.2.zip
    sha512: PGFqCtiFep27rJcE3s8J2BAH9GQIRg460J0IVwbUCQERLZlN8YP71B1xWW09gCmA5YeEY4oDynqBLmgQfEFtfw==
    size: 148022367
  - url: signal-desktop-mac-x64-1.23.2.dmg
    sha512: xbX5QDyzdvQd6rVzpamRLfWu+oIbhlW9pLbpKywQSiEx6BPZHTYCulBx9V5zrKh7TNM9nRpZJ3Sph2bU3v+5uQ==
    size: 154866781
  - url: signal-desktop-mac-arm64-1.23.2.dmg
    sha512: 7wgGWCogQ9OWMGnqEUmiSeRct3w60zyzYp5cIUvJIVFe8WoB/qS7n721n+xCsrdteclR6yu1cqkOh/xN/wgS0Q==
    size: 152618547
path: signal-desktop-mac-x64-1.23.2.zip
sha512: STurwHhpE2rwwpwz3/RQBbMbVYY2Hh1DVpeofwIWPXoDTX/41zia+ByKXq8BvnjIMdQ3YmPHu+UppAW/+CFkFQ==
releaseDate: '2021-12-03T19:00:23.754Z'
`);
  const windowsBeta = parseYaml(`version: 1.23.2-beta.1
files:
  - url: signal-desktop-beta-win-1.23.2-beta.1.exe
    sha512: ZHM1F3y/Y6ulP5NhbFuh7t2ZCpY4lD9BeBhPV+g2B/0p/66kp0MJDeVxTgjR49OakwpMAafA1d6y2QBail4hSQ==
    size: 92028656
path: signal-desktop-beta-win-1.23.2-beta.1.exe
sha512: ZHM1F3y/Y6ulP5NhbFuh7t2ZCpY4lD9BeBhPV+g2B/0p/66kp0MJDeVxTgjR49OakwpMAafA1d6y2QBail4hSQ==
releaseDate: '2019-03-29T01:56:00.544Z'
`);
  const macBeta = parseYaml(`version: 1.23.2-beta.1
files:
  - url: signal-desktop-mac-x64-1.23.2-beta.1.zip
    sha512: STurwHhpE2rwwpwz3/RQBbMbVYY2Hh1DVpeofwIWPXoDTX/41zia+ByKXq8BvnjIMdQ3YmPHu+UppAW/+CFkFQ==
    size: 150317727
  - url: signal-desktop-mac-arm64-1.23.2-beta.1.zip
    sha512: PGFqCtiFep27rJcE3s8J2BAH9GQIRg460J0IVwbUCQERLZlN8YP71B1xWW09gCmA5YeEY4oDynqBLmgQfEFtfw==
    size: 148022367
  - url: signal-desktop-mac-x64-1.23.2-beta.1.dmg
    sha512: xbX5QDyzdvQd6rVzpamRLfWu+oIbhlW9pLbpKywQSiEx6BPZHTYCulBx9V5zrKh7TNM9nRpZJ3Sph2bU3v+5uQ==
    size: 154866781
  - url: signal-desktop-mac-arm64-1.23.2-beta.1.dmg
    sha512: 7wgGWCogQ9OWMGnqEUmiSeRct3w60zyzYp5cIUvJIVFe8WoB/qS7n721n+xCsrdteclR6yu1cqkOh/xN/wgS0Q==
    size: 152618547
path: signal-desktop-mac-x64-1.23.2-beta.1.zip
sha512: STurwHhpE2rwwpwz3/RQBbMbVYY2Hh1DVpeofwIWPXoDTX/41zia+ByKXq8BvnjIMdQ3YmPHu+UppAW/+CFkFQ==
releaseDate: '2021-12-03T19:00:23.754Z'
`);

  describe('#getVersion', () => {
    it('successfully gets version', () => {
      const expected = '1.23.2';
      assert.strictEqual(getVersion(windows), expected);
      assert.strictEqual(getVersion(mac), expected);

      const expectedBeta = '1.23.2-beta.1';
      assert.strictEqual(getVersion(windowsBeta), expectedBeta);
      assert.strictEqual(getVersion(macBeta), expectedBeta);
    });
  });

  describe('#getUpdateFileName', () => {
    it('successfully gets version', () => {
      assert.strictEqual(
        getUpdateFileName(windows, 'win32', 'x64'),
        'signal-desktop-win-1.23.2.exe'
      );
      assert.strictEqual(
        getUpdateFileName(mac, 'darwin', 'x64'),
        'signal-desktop-mac-x64-1.23.2.zip'
      );
      assert.strictEqual(
        getUpdateFileName(mac, 'darwin', 'arm64'),
        'signal-desktop-mac-arm64-1.23.2.zip'
      );
      assert.strictEqual(
        getUpdateFileName(windowsBeta, 'win32', 'x64'),
        'signal-desktop-beta-win-1.23.2-beta.1.exe'
      );
      assert.strictEqual(
        getUpdateFileName(macBeta, 'darwin', 'x64'),
        'signal-desktop-mac-x64-1.23.2-beta.1.zip'
      );
      assert.strictEqual(
        getUpdateFileName(macBeta, 'darwin', 'arm64'),
        'signal-desktop-mac-arm64-1.23.2-beta.1.zip'
      );
    });
  });

  describe('#isUpdateFileNameValid', () => {
    it('returns true for normal filenames', () => {
      assert.strictEqual(
        isUpdateFileNameValid('signal-desktop-win-1.23.2.exe'),
        true
      );
      assert.strictEqual(
        isUpdateFileNameValid('signal-desktop-mac-x64-1.23.2-beta.1.zip'),
        true
      );
    });
    it('returns false for problematic names', () => {
      assert.strictEqual(
        isUpdateFileNameValid('../signal-desktop-win-1.23.2.exe'),
        false
      );
      assert.strictEqual(
        isUpdateFileNameValid('%signal-desktop-mac-x64-1.23.2-beta.1.zip'),
        false
      );
      assert.strictEqual(
        isUpdateFileNameValid('@signal-desktop-mac-x64-1.23.2-beta.1.zip'),
        false
      );
    });
  });

  describe('#validatePath', () => {
    it('succeeds for simple children', async () => {
      const base = await createUpdateCacheDirIfNeeded();
      validatePath(base, `${base}/child`);
      validatePath(base, `${base}/child/grandchild`);
    });
    it('returns false for problematic names', async () => {
      const base = await createUpdateCacheDirIfNeeded();
      assert.throws(() => {
        validatePath(base, `${base}/../child`);
      });
      assert.throws(() => {
        validatePath(base, '/root');
      });
    });
  });

  describe('createTempDir', () => {
    it('creates a temporary directory', async () => {
      const dir = await createTempDir();
      assert.isTrue((await stat(dir)).isDirectory());

      await deleteTempDir(log, dir);

      assert.isFalse(await pathExists(dir), 'Directory should be deleted');
    });
  });

  describe('getTempDir', () => {
    it('reserves a temporary directory', async () => {
      const dir = await getTempDir();
      assert.isTrue(
        (await stat(join(dir, '..'))).isDirectory(),
        'Parent folder should exist'
      );
      assert.isFalse(await pathExists(dir), 'Reserved folder should not exist');

      await mkdir(dir);

      await deleteTempDir(log, dir);

      assert.isFalse(await pathExists(dir), 'Directory should be deleted');
    });
  });
});
