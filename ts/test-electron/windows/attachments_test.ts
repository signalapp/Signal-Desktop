// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import path from 'path';
import fs from 'fs';
import os from 'os';
import fse from 'fs-extra';
import * as Attachments from '../../windows/attachments';
import * as Bytes from '../../Bytes';

const PREFIX_LENGTH = 2;
const NUM_SEPARATORS = 1;
const NAME_LENGTH = 64;
const PATH_LENGTH = PREFIX_LENGTH + NUM_SEPARATORS + NAME_LENGTH;

describe('Attachments', () => {
  const USER_DATA = window.SignalContext.getPath('userData');

  let tempRootDirectory: string;

  before(() => {
    tempRootDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'Signal'));
  });

  after(async () => {
    await fse.remove(tempRootDirectory);
  });

  describe('createReader', () => {
    it('should read file from disk', async () => {
      const tempDirectory = path.join(
        tempRootDirectory,
        'Attachments_createReader'
      );

      const relativePath = Attachments.getRelativePath(
        Attachments.createName()
      );
      const fullPath = path.join(tempDirectory, relativePath);
      const input = Bytes.fromString('test string');

      const inputBuffer = Buffer.from(input);
      await fse.ensureFile(fullPath);
      await fse.writeFile(fullPath, inputBuffer);
      const output = await Attachments.createReader(tempDirectory)(
        relativePath
      );

      assert.deepEqual(input, output);
    });

    it('throws if relative path goes higher than root', async () => {
      const tempDirectory = path.join(
        tempRootDirectory,
        'Attachments_createReader'
      );

      const relativePath = '../../parent';

      await assert.isRejected(
        Attachments.createReader(tempDirectory)(relativePath),
        'Invalid relative path'
      );
    });
  });

  describe('copyIntoAttachmentsDirectory', () => {
    let filesToRemove: Array<string>;

    const getFakeAttachmentsDirectory = () => {
      const result = path.join(
        USER_DATA,
        `fake-attachments-${Date.now()}-${Math.random()
          .toString()
          .substring(2)}`
      );
      filesToRemove.push(result);
      return result;
    };

    // These tests use the `userData` path. In `electron-mocha`, these are temporary
    //   directories; no need to be concerned about messing with the "real" directory.
    before(() => {
      filesToRemove = [];
    });

    after(async () => {
      await Promise.all(filesToRemove.map(toRemove => fse.remove(toRemove)));
      filesToRemove = [];
    });

    it('throws if passed a non-string', () => {
      assert.throws(() => {
        Attachments.copyIntoAttachmentsDirectory(1234 as unknown as string);
      }, TypeError);
      assert.throws(() => {
        Attachments.copyIntoAttachmentsDirectory(null as unknown as string);
      }, TypeError);
    });

    it('returns a function that rejects if the source path is not a string', async () => {
      const copier = Attachments.copyIntoAttachmentsDirectory(
        await getFakeAttachmentsDirectory()
      );
      await assert.isRejected(copier(123 as unknown as string));
    });

    it('returns a function that rejects if the source path is not in the user config directory', async () => {
      const copier = Attachments.copyIntoAttachmentsDirectory(
        await getFakeAttachmentsDirectory()
      );
      await assert.isRejected(
        copier(path.join(tempRootDirectory, 'hello.txt')),
        "'sourcePath' must be relative to the user config directory"
      );
    });

    it('returns a function that copies the source path into the attachments directory and returns its path and size', async () => {
      const attachmentsPath = await getFakeAttachmentsDirectory();
      const someOtherPath = path.join(USER_DATA, 'somethingElse');
      await fse.outputFile(someOtherPath, 'hello world');
      filesToRemove.push(someOtherPath);

      const copier = Attachments.copyIntoAttachmentsDirectory(attachmentsPath);
      const { path: relativePath, size } = await copier(someOtherPath);

      const absolutePath = path.join(attachmentsPath, relativePath);
      assert.notEqual(someOtherPath, absolutePath);
      assert.strictEqual(
        await fs.promises.readFile(absolutePath, 'utf8'),
        'hello world'
      );

      assert.strictEqual(size, 'hello world'.length);
    });
  });

  describe('createWriterForExisting', () => {
    it('should write file to disk on given path and return path', async () => {
      const input = Bytes.fromString('test string');
      const tempDirectory = path.join(
        tempRootDirectory,
        'Attachments_createWriterForExisting'
      );

      const relativePath = Attachments.getRelativePath(
        Attachments.createName()
      );
      const attachment = {
        path: relativePath,
        data: input,
      };
      const outputPath = await Attachments.createWriterForExisting(
        tempDirectory
      )(attachment);
      const output = await fse.readFile(path.join(tempDirectory, outputPath));

      assert.equal(outputPath, relativePath);

      const inputBuffer = Buffer.from(input);
      assert.deepEqual(inputBuffer, output);
    });

    it('throws if relative path goes higher than root', async () => {
      const input = Bytes.fromString('test string');
      const tempDirectory = path.join(
        tempRootDirectory,
        'Attachments_createWriterForExisting'
      );

      const relativePath = '../../parent';
      const attachment = {
        path: relativePath,
        data: input,
      };
      try {
        await Attachments.createWriterForExisting(tempDirectory)(attachment);
      } catch (error) {
        assert.strictEqual(error.message, 'Invalid relative path');
        return;
      }

      throw new Error('Expected an error');
    });
  });

  describe('createWriterForNew', () => {
    it('should write file to disk and return path', async () => {
      const input = Bytes.fromString('test string');
      const tempDirectory = path.join(
        tempRootDirectory,
        'Attachments_createWriterForNew'
      );

      const outputPath = await Attachments.createWriterForNew(tempDirectory)(
        input
      );
      const output = await fse.readFile(path.join(tempDirectory, outputPath));

      assert.lengthOf(outputPath, PATH_LENGTH);

      const inputBuffer = Buffer.from(input);
      assert.deepEqual(inputBuffer, output);
    });
  });

  describe('createAbsolutePathGetter', () => {
    const isWindows = process.platform === 'win32';

    it('combines root and relative path', () => {
      const root = isWindows ? 'C:\\temp' : '/tmp';
      const relative = 'ab/abcdef';
      const pathGetter = Attachments.createAbsolutePathGetter(root);
      const absolutePath = pathGetter(relative);

      assert.strictEqual(
        absolutePath,
        isWindows ? 'C:\\temp\\ab\\abcdef' : '/tmp/ab/abcdef'
      );
    });

    it('throws if relative path goes higher than root', () => {
      const root = isWindows ? 'C:\\temp' : 'tmp';
      const relative = '../../ab/abcdef';
      const pathGetter = Attachments.createAbsolutePathGetter(root);

      try {
        pathGetter(relative);
      } catch (error) {
        assert.strictEqual(error.message, 'Invalid relative path');
        return;
      }

      throw new Error('Expected an error');
    });
  });

  describe('createName', () => {
    it('should return random file name with correct length', () => {
      assert.lengthOf(Attachments.createName(), NAME_LENGTH);
    });

    it('can include a suffix', () => {
      const result = Attachments.createName('.txt');
      assert.lengthOf(result, NAME_LENGTH + '.txt'.length);
      assert(result.endsWith('.txt'));
    });
  });

  describe('getRelativePath', () => {
    it('should return correct path', () => {
      const name =
        '608ce3bc536edbf7637a6aeb6040bdfec49349140c0dd43e97c7ce263b15ff7e';
      assert.lengthOf(Attachments.getRelativePath(name), PATH_LENGTH);
    });
  });

  describe('createDeleter', () => {
    it('should delete file from disk', async () => {
      const tempDirectory = path.join(
        tempRootDirectory,
        'Attachments_createDeleter'
      );

      const relativePath = Attachments.getRelativePath(
        Attachments.createName()
      );
      const fullPath = path.join(tempDirectory, relativePath);
      const input = Bytes.fromString('test string');

      const inputBuffer = Buffer.from(input);
      await fse.ensureFile(fullPath);
      await fse.writeFile(fullPath, inputBuffer);
      await Attachments.createDeleter(tempDirectory)(relativePath);

      const existsFile = await fse.pathExists(fullPath);
      assert.isFalse(existsFile);
    });

    it('throws if relative path goes higher than root', async () => {
      const tempDirectory = path.join(
        tempRootDirectory,
        'Attachments_createDeleter'
      );

      const relativePath = '../../parent';

      try {
        await Attachments.createDeleter(tempDirectory)(relativePath);
      } catch (error) {
        assert.strictEqual(error.message, 'Invalid relative path');
        return;
      }

      throw new Error('Expected an error');
    });
  });
});
