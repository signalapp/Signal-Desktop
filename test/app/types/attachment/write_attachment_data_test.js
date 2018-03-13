const FSE = require('fs-extra');
const isEqual = require('lodash/isEqual');
const Path = require('path');
const stringToArrayBuffer = require('string-to-arraybuffer');
const tempy = require('tempy');
const { assert } = require('chai');

const {
  writeAttachmentData,
  _getAttachmentName,
  _getAttachmentPath,
} = require('../../../../app/types/attachment/write_attachment_data');


describe('writeAttachmentData', () => {
  let TEMPORARY_DIRECTORY = null;
  before(() => {
    // Sync!
    TEMPORARY_DIRECTORY = tempy.directory();
  });

  after(async () => {
    await FSE.remove(TEMPORARY_DIRECTORY);
  });

  it('should write file to disk and return path', async () => {
    const input = stringToArrayBuffer('test string');
    const tempDirectory = Path.join(TEMPORARY_DIRECTORY, 'writeAttachmentData');
    const expectedPath = Path.join(
      tempDirectory,
      'd55/d5579c46dfcc7f18207013e65b44e4cb4e2c2298f4ac457ba8f82743f31e930b'
    );

    const outputPath = await writeAttachmentData(tempDirectory)(input);
    const output = await FSE.readFile(outputPath);

    assert.strictEqual(outputPath, expectedPath);

    const inputBuffer = Buffer.from(input);
    assert.isTrue(isEqual(inputBuffer, output));
  });

  describe('_getAttachmentName', () => {
    it('should return correct name', () => {
      const input = Buffer.from('test string', 'utf8');
      const expected = 'd5579c46dfcc7f18207013e65b44e4cb4e2c2298f4ac457ba8f82743f31e930b';
      assert.strictEqual(_getAttachmentName(input), expected);
    });
  });

  describe('_getAttachmentPath', () => {
    it('should return correct path', () => {
      const input = Buffer.from('test string', 'utf8');
      const expected = 'd55/d5579c46dfcc7f18207013e65b44e4cb4e2c2298f4ac457ba8f82743f31e930b';
      assert.strictEqual(_getAttachmentPath(input), expected);
    });
  });
});
