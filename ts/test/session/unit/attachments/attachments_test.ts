import fse from 'fs-extra';
import path from 'path';
import tmp from 'tmp';
import { assert } from 'chai';

import * as Attachments from '../../../../attachments/attachments';
import { stringToArrayBuffer } from '../../../../session/utils/String';
import { decryptAttachmentBuffer, encryptAttachmentBuffer } from '../../../../types/Attachment';
import { TestUtils } from '../../../test-utils';

const PREFIX_LENGTH = 2;
const NUM_SEPARATORS = 1;
const NAME_LENGTH = 64;
const PATH_LENGTH = PREFIX_LENGTH + NUM_SEPARATORS + NAME_LENGTH;

// tslint:disable-next-line: max-func-body-length
describe('Attachments', () => {
  describe('createWriterForNew', () => {
    let tempRootDirectory: any = null;
    before(() => {
      tempRootDirectory = tmp.dirSync().name;
      TestUtils.stubWindow('textsecure', {
        storage: {
          get: () => '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        },
      });
    });

    after(async () => {
      await fse.remove(tempRootDirectory);
      TestUtils.restoreStubs();
    });

    it('should write file to disk and return path', async () => {
      const input = stringToArrayBuffer('test string');
      const tempDirectory = path.join(tempRootDirectory, 'Attachments_createWriterForNew');
      const outputPath = await Attachments.createWriterForNew(tempDirectory)(input);
      const output = await fse.readFile(path.join(tempDirectory, outputPath));

      assert.lengthOf(outputPath, PATH_LENGTH);

      const outputDecrypted = Buffer.from(await decryptAttachmentBuffer(output.buffer));

      const inputBuffer = Buffer.from(input);
      assert.deepEqual(inputBuffer, outputDecrypted);
    });
  });

  describe('createWriterForExisting', () => {
    let tempRootDirectory: any = null;
    before(() => {
      tempRootDirectory = tmp.dirSync().name;
      TestUtils.stubWindow('textsecure', {
        storage: {
          get: () => '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        },
      });
    });

    after(async () => {
      await fse.remove(tempRootDirectory);
      TestUtils.restoreStubs();
    });

    it('should write file to disk on given path and return path', async () => {
      const input = stringToArrayBuffer('test string');
      const tempDirectory = path.join(tempRootDirectory, 'Attachments_createWriterForExisting');

      const relativePath = Attachments.getRelativePath(Attachments.createName());
      const attachment = {
        path: relativePath,
        data: input,
      };
      const outputPath = await Attachments.createWriterForExisting(tempDirectory)(attachment);
      const output = await fse.readFile(path.join(tempDirectory, outputPath));

      assert.equal(outputPath, relativePath);
      const outputDecrypted = Buffer.from(await decryptAttachmentBuffer(output.buffer));
      const inputBuffer = Buffer.from(input);
      assert.deepEqual(inputBuffer, outputDecrypted);
    });

    it('throws if relative path goes higher than root', async () => {
      const input = stringToArrayBuffer('test string');
      const tempDirectory = path.join(tempRootDirectory, 'Attachments_createWriterForExisting');

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

  describe('createReader', () => {
    let tempRootDirectory: any = null;
    before(() => {
      tempRootDirectory = tmp.dirSync().name;
      TestUtils.stubWindow('textsecure', {
        storage: {
          get: () => '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        },
      });
    });

    after(async () => {
      await fse.remove(tempRootDirectory);
      TestUtils.restoreStubs();
    });

    it('should read file from disk', async () => {
      const tempDirectory = path.join(tempRootDirectory, 'Attachments_createReader');

      const relativePath = Attachments.getRelativePath(Attachments.createName());
      const fullPath = path.join(tempDirectory, relativePath);
      const input = stringToArrayBuffer('test string');

      const encryptedInput = await encryptAttachmentBuffer(input);

      const inputBuffer = Buffer.from(encryptedInput.encryptedBufferWithHeader);
      await fse.ensureFile(fullPath);
      await fse.writeFile(fullPath, inputBuffer);
      const outputDecrypted = await Attachments.createReader(tempDirectory)(relativePath);
      assert.deepEqual(new Uint8Array(input), new Uint8Array(outputDecrypted));
    });

    it('throws if relative path goes higher than root', async () => {
      const tempDirectory = path.join(tempRootDirectory, 'Attachments_createReader');

      const relativePath = '../../parent';

      try {
        await Attachments.createReader(tempDirectory)(relativePath);
      } catch (error) {
        assert.strictEqual(error.message, 'Invalid relative path');
        return;
      }

      throw new Error('Expected an error');
    });
  });

  describe('createDeleter', () => {
    let tempRootDirectory: any = null;
    before(() => {
      tempRootDirectory = tmp.dirSync().name;
    });

    after(async () => {
      await fse.remove(tempRootDirectory);
    });

    it('should delete file from disk', async () => {
      const tempDirectory = path.join(tempRootDirectory, 'Attachments_createDeleter');

      const relativePath = Attachments.getRelativePath(Attachments.createName());
      const fullPath = path.join(tempDirectory, relativePath);
      const input = stringToArrayBuffer('test string');

      const inputBuffer = Buffer.from(input);
      await fse.ensureFile(fullPath);
      await fse.writeFile(fullPath, inputBuffer);
      await Attachments.createDeleter(tempDirectory)(relativePath);

      const existsFile = fse.existsSync(fullPath);
      assert.isFalse(existsFile);
    });

    it('throws if relative path goes higher than root', async () => {
      const tempDirectory = path.join(tempRootDirectory, 'Attachments_createDeleter');

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

  describe('createName', () => {
    it('should return random file name with correct length', () => {
      assert.lengthOf(Attachments.createName(), NAME_LENGTH);
    });
  });

  describe('getRelativePath', () => {
    it('should return correct path', () => {
      const name = '608ce3bc536edbf7637a6aeb6040bdfec49349140c0dd43e97c7ce263b15ff7e';
      assert.lengthOf(Attachments.getRelativePath(name), PATH_LENGTH);
    });
  });

  describe('createAbsolutePathGetter', () => {
    const isWindows = process.platform === 'win32';

    it('combines root and relative path', () => {
      const root = isWindows ? 'C:\\temp' : '/tmp';
      const relative = 'ab/abcdef';
      const pathGetter = Attachments.createAbsolutePathGetter(root);
      const absolutePath = pathGetter(relative);

      assert.strictEqual(absolutePath, isWindows ? 'C:\\temp\\ab\\abcdef' : '/tmp/ab/abcdef');
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
});
