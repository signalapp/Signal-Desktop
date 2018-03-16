const fse = require('fs-extra');
const isEqual = require('lodash/isEqual');
const path = require('path');
const stringToArrayBuffer = require('string-to-arraybuffer');
const tmp = require('tmp');
const { assert } = require('chai');

const {
  writeAttachmentData,
  _getAttachmentName,
  _getAttachmentPath,
} = require('../../../../app/types/attachment/write_attachment_data');


const PREFIX_LENGTH = 2;
const NUM_SEPARATORS = 1;
const NAME_LENGTH = 64;
const PATH_LENGTH = PREFIX_LENGTH + NUM_SEPARATORS + NAME_LENGTH;

describe('writeAttachmentData', () => {
  let TEMPORARY_DIRECTORY = null;
  before(() => {
    TEMPORARY_DIRECTORY = tmp.dirSync().name;
  });

  after(async () => {
    await fse.remove(TEMPORARY_DIRECTORY);
  });

  it('should write file to disk and return path', async () => {
    const input = stringToArrayBuffer('test string');
    const tempDirectory = path.join(TEMPORARY_DIRECTORY, 'writeAttachmentData');

    const outputPath = await writeAttachmentData(tempDirectory)(input);
    const output = await fse.readFile(path.join(tempDirectory, outputPath));

    assert.lengthOf(outputPath, PATH_LENGTH);

    const inputBuffer = Buffer.from(input);
    assert.isTrue(isEqual(inputBuffer, output));
  });

  describe('_getAttachmentName', () => {
    it('should return random file name with correct length', () => {
      assert.lengthOf(_getAttachmentName(), NAME_LENGTH);
    });
  });

  describe('_getAttachmentPath', () => {
    it('should return correct path', () => {
      assert.lengthOf(_getAttachmentPath(), PATH_LENGTH);
    });
  });
});
