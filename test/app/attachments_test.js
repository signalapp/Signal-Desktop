const fse = require('fs-extra');
const path = require('path');
const tmp = require('tmp');
const { assert } = require('chai');

const Attachments = require('../../app/attachments');
const { stringToArrayBuffer } = require('../../js/modules/string_to_array_buffer');


const PREFIX_LENGTH = 2;
const NUM_SEPARATORS = 1;
const NAME_LENGTH = 64;
const PATH_LENGTH = PREFIX_LENGTH + NUM_SEPARATORS + NAME_LENGTH;

describe('Attachments', () => {
  describe('createWriterForNew', () => {
    let tempRootDirectory = null;
    before(() => {
      tempRootDirectory = tmp.dirSync().name;
    });

    after(async () => {
      await fse.remove(tempRootDirectory);
    });

    it('should write file to disk and return path', async () => {
      const input = stringToArrayBuffer('test string');
      const tempDirectory = path.join(
        tempRootDirectory,
        'Attachments_createWriterForNew'
      );

      const outputPath = await Attachments.createWriterForNew(tempDirectory)(input);
      const output = await fse.readFile(path.join(tempDirectory, outputPath));

      assert.lengthOf(outputPath, PATH_LENGTH);

      const inputBuffer = Buffer.from(input);
      assert.deepEqual(inputBuffer, output);
    });
  });

  describe('createReader', () => {
    let tempRootDirectory = null;
    before(() => {
      tempRootDirectory = tmp.dirSync().name;
    });

    after(async () => {
      await fse.remove(tempRootDirectory);
    });

    it('should read file from disk', async () => {
      const tempDirectory = path.join(tempRootDirectory, 'Attachments_createReader');

      const relativePath = Attachments.getRelativePath(Attachments.createName());
      const fullPath = path.join(tempDirectory, relativePath);
      const input = stringToArrayBuffer('test string');

      const inputBuffer = Buffer.from(input);
      await fse.ensureFile(fullPath);
      await fse.writeFile(fullPath, inputBuffer);
      const output = await Attachments.createReader(tempDirectory)(relativePath);

      assert.deepEqual(input, output);
    });
  });

  describe('createDeleter', () => {
    let tempRootDirectory = null;
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

      const existsFile = await fse.exists(fullPath);
      assert.isFalse(existsFile);
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
});
