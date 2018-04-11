require('mocha-testcheck').install();

const { assert } = require('chai');

const Attachment = require('../../../js/modules/types/attachment');
const { stringToArrayBuffer } = require('../../../js/modules/string_to_array_buffer');

describe('Attachment', () => {
  describe('replaceUnicodeOrderOverrides', () => {
    it('should sanitize left-to-right order override character', async () => {
      const input = {
        contentType: 'image/jpeg',
        data: null,
        fileName: 'test\u202Dfig.exe',
        size: 1111,
      };
      const expected = {
        contentType: 'image/jpeg',
        data: null,
        fileName: 'test\uFFFDfig.exe',
        size: 1111,
      };

      const actual = await Attachment.replaceUnicodeOrderOverrides(input);
      assert.deepEqual(actual, expected);
    });

    it('should sanitize right-to-left order override character', async () => {
      const input = {
        contentType: 'image/jpeg',
        data: null,
        fileName: 'test\u202Efig.exe',
        size: 1111,
      };
      const expected = {
        contentType: 'image/jpeg',
        data: null,
        fileName: 'test\uFFFDfig.exe',
        size: 1111,
      };

      const actual = await Attachment.replaceUnicodeOrderOverrides(input);
      assert.deepEqual(actual, expected);
    });

    it('should sanitize multiple override characters', async () => {
      const input = {
        contentType: 'image/jpeg',
        data: null,
        fileName: 'test\u202e\u202dlol\u202efig.exe',
        size: 1111,
      };
      const expected = {
        contentType: 'image/jpeg',
        data: null,
        fileName: 'test\uFFFD\uFFFDlol\uFFFDfig.exe',
        size: 1111,
      };

      const actual = await Attachment.replaceUnicodeOrderOverrides(input);
      assert.deepEqual(actual, expected);
    });

    const hasNoUnicodeOrderOverrides = value =>
      !value.includes('\u202D') && !value.includes('\u202E');

    check.it(
      'should ignore non-order-override characters',
      gen.string.suchThat(hasNoUnicodeOrderOverrides),
      (fileName) => {
        const input = {
          contentType: 'image/jpeg',
          data: null,
          fileName,
          size: 1111,
        };

        const actual = Attachment._replaceUnicodeOrderOverridesSync(input);
        assert.deepEqual(actual, input);
      }
    );
  });

  describe('removeSchemaVersion', () => {
    it('should remove existing schema version', () => {
      const input = {
        contentType: 'image/jpeg',
        data: null,
        fileName: 'foo.jpg',
        size: 1111,
        schemaVersion: 1,
      };

      const expected = {
        contentType: 'image/jpeg',
        data: null,
        fileName: 'foo.jpg',
        size: 1111,
      };

      const actual = Attachment.removeSchemaVersion(input);
      assert.deepEqual(actual, expected);
    });
  });

  describe('migrateDataToFileSystem', () => {
    it('should write data to disk and store relative path to it', async () => {
      const input = {
        contentType: 'image/jpeg',
        data: stringToArrayBuffer('Above us only sky'),
        fileName: 'foo.jpg',
        size: 1111,
      };

      const expected = {
        contentType: 'image/jpeg',
        path: 'abc/abcdefgh123456789',
        fileName: 'foo.jpg',
        size: 1111,
      };

      const expectedAttachmentData = stringToArrayBuffer('Above us only sky');
      const writeNewAttachmentData = async (attachmentData) => {
        assert.deepEqual(attachmentData, expectedAttachmentData);
        return 'abc/abcdefgh123456789';
      };

      const actual = await Attachment.migrateDataToFileSystem(
        input,
        { writeNewAttachmentData }
      );
      assert.deepEqual(actual, expected);
    });

    it('should skip over (invalid) attachments without data', async () => {
      const input = {
        contentType: 'image/jpeg',
        fileName: 'foo.jpg',
        size: 1111,
      };

      const expected = {
        contentType: 'image/jpeg',
        fileName: 'foo.jpg',
        size: 1111,
      };

      const writeNewAttachmentData = async () =>
        'abc/abcdefgh123456789';

      const actual = await Attachment.migrateDataToFileSystem(
        input,
        { writeNewAttachmentData }
      );
      assert.deepEqual(actual, expected);
    });

    it('should throw error if data is not valid', async () => {
      const input = {
        contentType: 'image/jpeg',
        data: 42,
        fileName: 'foo.jpg',
        size: 1111,
      };

      const writeNewAttachmentData = async () =>
        'abc/abcdefgh123456789';

      try {
        await Attachment.migrateDataToFileSystem(input, { writeNewAttachmentData });
      } catch (error) {
        assert.strictEqual(
          error.message,
          'Expected `attachment.data` to be an array buffer; got: number'
        );
        return;
      }

      assert.fail('Unreachable');
    });
  });
});
