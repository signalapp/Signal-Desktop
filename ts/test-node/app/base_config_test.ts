// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as path from 'path';
import { tmpdir } from 'os';
import { chmodSync, rmSync, writeFileSync, mkdtempSync } from 'fs';
import { pathExists, readJsonSync } from 'fs-extra';

import { v4 as generateGuid } from 'uuid';
import { assert } from 'chai';

import type { ConfigType } from '../../../app/base_config';
import { start } from '../../../app/base_config';

describe('base_config', () => {
  let targetDir: string;
  let targetPath: string;

  beforeEach(() => {
    targetDir = mkdtempSync(path.join(tmpdir(), 'base_config'));
    targetPath = path.join(targetDir, `${generateGuid()}.json`);
  });

  afterEach(() => {
    try {
      chmodSync(targetDir, 0o755);
      chmodSync(targetPath, 0o755);
      rmSync(targetDir, { recursive: true });
    } catch (err) {
      assert.strictEqual(err.code, 'ENOENT');
    }
  });

  describe('start', () => {
    it('does not throw if file is missing', () => {
      const { _getCachedValue } = start({
        name: 'test',
        targetPath,
        throwOnFilesystemErrors: true,
      });
      assert.deepEqual(_getCachedValue(), Object.create(null));
    });

    it("doesn't create the file if it is missing", async () => {
      start({ name: 'test', targetPath, throwOnFilesystemErrors: true });
      assert.isFalse(await pathExists(targetPath));
    });

    it('does not throw if file is empty', () => {
      writeFileSync(targetPath, '');
      const { _getCachedValue } = start({
        name: 'test',
        targetPath,
        throwOnFilesystemErrors: true,
      });
      assert.deepEqual(_getCachedValue(), Object.create(null));
    });

    it('successfully loads config file', () => {
      const config = { a: 1, b: 2 };
      writeFileSync(targetPath, JSON.stringify(config));
      const { _getCachedValue } = start({
        name: 'test',
        targetPath,
        throwOnFilesystemErrors: true,
      });
      assert.deepEqual(_getCachedValue(), config);
    });

    describe('throwOnFilesystemErrors: true', () => {
      it('throws if file is malformed', () => {
        writeFileSync(targetPath, '{{ malformed JSON');
        assert.throws(() => {
          start({ name: 'test', targetPath, throwOnFilesystemErrors: true });
        });
      });
    });

    describe('throwOnFilesystemErrors: false', () => {
      it('handles a malformed file, if told to', () => {
        writeFileSync(targetPath, '{{ malformed JSON');
        const { _getCachedValue } = start({
          name: 'test',
          targetPath,
          throwOnFilesystemErrors: false,
        });
        assert.deepEqual(_getCachedValue(), Object.create(null));
      });

      it('handles a file that cannot be opened, if told to', function (this: Mocha.Context) {
        if (process.platform === 'win32') {
          this.skip();
        }

        writeFileSync(targetPath, JSON.stringify({ foo: 123 }));
        chmodSync(targetDir, 0);
        const { _getCachedValue } = start({
          name: 'test',
          targetPath,
          throwOnFilesystemErrors: false,
        });
        assert.deepEqual(_getCachedValue(), Object.create(null));
      });
    });
  });

  describe('get', () => {
    let config: ConfigType;
    beforeEach(() => {
      writeFileSync(targetPath, JSON.stringify({ foo: 123, bar: [1, 2, 3] }));
      config = start({
        name: 'test',
        targetPath,
        throwOnFilesystemErrors: true,
      });
    });

    it('returns undefined for missing keys', () => {
      assert.isUndefined(config.get('garbage'));
    });

    it('can look up values by path', () => {
      assert.strictEqual(config.get('foo'), 123);
      assert.strictEqual(config.get('bar.1'), 2);
    });
  });

  describe('set', () => {
    it('updates data in memory by path', () => {
      const config = start({
        name: 'test',
        targetPath,
        throwOnFilesystemErrors: true,
      });
      config.set('foo', 1);
      config.set('bar.baz', 2);

      assert.strictEqual(config.get('foo'), 1);
      assert.deepStrictEqual(config.get('bar'), { baz: 2 });
    });

    it('saves data to disk', () => {
      const config = start({
        name: 'test',
        targetPath,
        throwOnFilesystemErrors: true,
      });

      config.set('foo', 123);
      assert.deepStrictEqual(readJsonSync(targetPath), { foo: 123 });

      config.set('bar.baz', 2);
      assert.deepStrictEqual(readJsonSync(targetPath), {
        foo: 123,
        bar: { baz: 2 },
      });

      config.set('foo', undefined);
      assert.deepStrictEqual(readJsonSync(targetPath), { bar: { baz: 2 } });
    });

    describe('throwOnFilesystemErrors: true', () => {
      it("doesn't update in-memory data if file write fails", () => {
        const config = start({
          name: 'test',
          targetPath,
          throwOnFilesystemErrors: true,
        });
        config.set('foo', 123);
        rmSync(targetDir, { recursive: true });

        assert.throws(() => config.set('foo', 456));
        assert.strictEqual(config.get('foo'), 123);

        assert.throws(() => config.set('bar', 999));
        assert.isUndefined(config.get('bar'));
      });
    });

    describe('throwOnFilesystemErrors: false', () => {
      it('updates in-memory data even if file write fails', () => {
        const config = start({
          name: 'test',
          targetPath,
          throwOnFilesystemErrors: false,
        });
        config.set('foo', 123);
        rmSync(targetDir, { recursive: true });

        config.set('bar', 456);

        assert.strictEqual(config.get('bar'), 456);
      });
    });
  });

  describe('remove', () => {
    it('deletes all data from memory', () => {
      writeFileSync(targetPath, JSON.stringify({ foo: 123 }));
      const config = start({
        name: 'test',
        targetPath,
        throwOnFilesystemErrors: true,
      });
      config.remove();

      assert.isEmpty(config._getCachedValue());
    });

    it('does nothing if the file never existed', async () => {
      const config = start({
        name: 'test',
        targetPath,
        throwOnFilesystemErrors: true,
      });
      config.remove();

      assert.isFalse(await pathExists(targetPath));
    });

    it('removes the file on disk', async () => {
      writeFileSync(targetPath, JSON.stringify({ foo: 123 }));
      const config = start({
        name: 'test',
        targetPath,
        throwOnFilesystemErrors: true,
      });
      config.remove();

      assert.isFalse(await pathExists(targetPath));
    });

    describe('throwOnFilesystemErrors: true', () => {
      it("doesn't update the local cache if file removal fails", async function (this: Mocha.Context) {
        if (process.platform === 'win32') {
          this.skip();
        }

        // We put the config file in a directory, then remove all permissions from that
        //   directory. This should prevent removal.
        writeFileSync(targetPath, JSON.stringify({ foo: 123 }));
        const config = start({
          name: 'test',
          targetPath,
          throwOnFilesystemErrors: true,
        });
        chmodSync(targetDir, 0);

        assert.throws(() => config.remove());

        assert.deepStrictEqual(config._getCachedValue(), { foo: 123 });
      });
    });

    describe('throwOnFilesystemErrors: false', () => {
      it('updates the local cache even if file removal fails', async function (this: Mocha.Context) {
        if (process.platform === 'win32') {
          this.skip();
        }

        // See above.
        writeFileSync(targetPath, JSON.stringify({ foo: 123 }));
        const config = start({
          name: 'test',
          targetPath,
          throwOnFilesystemErrors: false,
        });
        chmodSync(targetDir, 0);

        config.remove();

        assert.isEmpty(config._getCachedValue());
      });
    });
  });
});
