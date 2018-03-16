const fse = require('fs-extra');
const isEqual = require('lodash/isEqual');
const path = require('path');
const stringToArrayBuffer = require('string-to-arraybuffer');
const tmp = require('tmp');
const { assert } = require('chai');

const Attachments = require('../../app/attachments');


const PREFIX_LENGTH = 2;
const NUM_SEPARATORS = 1;
const NAME_LENGTH = 64;
const PATH_LENGTH = PREFIX_LENGTH + NUM_SEPARATORS + NAME_LENGTH;

describe('Attachments', () => {
  describe('writeData', () => {
    let TEMPORARY_DIRECTORY = null;
    before(() => {
      TEMPORARY_DIRECTORY = tmp.dirSync().name;
    });

    after(async () => {
      await fse.remove(TEMPORARY_DIRECTORY);
    });

    it('should write file to disk and return path', async () => {
      const input = stringToArrayBuffer('test string');
      const tempDirectory = path.join(TEMPORARY_DIRECTORY, 'Attachments_writeData');

      const outputPath = await Attachments.writeData(tempDirectory)(input);
      const output = await fse.readFile(path.join(tempDirectory, outputPath));

      assert.lengthOf(outputPath, PATH_LENGTH);

      const inputBuffer = Buffer.from(input);
      assert.isTrue(isEqual(inputBuffer, output));
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
});
