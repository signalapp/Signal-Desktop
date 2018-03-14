require('mocha-testcheck').install();

const { assert } = require('chai');

const Attachment = require('../../../js/modules/types/attachment');

describe('Attachment', () => {
  describe('upgradeSchema', () => {
    it('should upgrade an unversioned attachment to the latest version', async () => {
      const input = {
        contentType: 'application/json',
        data: null,
        fileName: 'test\u202Dfig.exe',
        size: 1111,
      };
      const expected = {
        contentType: 'application/json',
        data: null,
        fileName: 'test\uFFFDfig.exe',
        size: 1111,
        schemaVersion: Attachment.CURRENT_SCHEMA_VERSION,
      };

      const actual = await Attachment.upgradeSchema(input);
      assert.deepEqual(actual, expected);
    });

    context('with multiple upgrade steps', () => {
      it('should return last valid attachment when any upgrade step fails', async () => {
        const input = {
          contentType: 'application/json',
          data: null,
          fileName: 'test\u202Dfig.exe',
          size: 1111,
        };
        const expected = {
          contentType: 'application/json',
          data: null,
          fileName: 'test\u202Dfig.exe',
          size: 1111,
          schemaVersion: 1,
          hasUpgradedToVersion1: true,
        };

        const v1 = async attachment =>
          Object.assign({}, attachment, { hasUpgradedToVersion1: true });
        const v2 = async () => {
          throw new Error('boom');
        };
        const v3 = async attachment =>
          Object.assign({}, attachment, { hasUpgradedToVersion3: true });

        const toVersion1 = Attachment.withSchemaVersion(1, v1);
        const toVersion2 = Attachment.withSchemaVersion(2, v2);
        const toVersion3 = Attachment.withSchemaVersion(3, v3);

        const upgradeSchema = async attachment =>
          toVersion3(await toVersion2(await toVersion1(attachment)));

        const actual = await upgradeSchema(input);
        assert.deepEqual(actual, expected);
      });

      it('should skip out-of-order upgrade steps', async () => {
        const input = {
          contentType: 'application/json',
          data: null,
          fileName: 'test\u202Dfig.exe',
          size: 1111,
        };
        const expected = {
          contentType: 'application/json',
          data: null,
          fileName: 'test\u202Dfig.exe',
          size: 1111,
          schemaVersion: 2,
          hasUpgradedToVersion1: true,
          hasUpgradedToVersion2: true,
        };

        const v1 = async attachment =>
          Object.assign({}, attachment, { hasUpgradedToVersion1: true });
        const v2 = async attachment =>
          Object.assign({}, attachment, { hasUpgradedToVersion2: true });
        const v3 = async attachment =>
          Object.assign({}, attachment, { hasUpgradedToVersion3: true });

        const toVersion1 = Attachment.withSchemaVersion(1, v1);
        const toVersion2 = Attachment.withSchemaVersion(2, v2);
        const toVersion3 = Attachment.withSchemaVersion(3, v3);

        // NOTE: We upgrade to 3 before 2, i.e. the pipeline should abort:
        const upgradeSchema = async attachment =>
          toVersion2(await toVersion3(await toVersion1(attachment)));

        const actual = await upgradeSchema(input);
        assert.deepEqual(actual, expected);
      });
    });
  });

  describe('withSchemaVersion', () => {
    it('should require a version number', () => {
      const toVersionX = () => {};
      assert.throws(
        () => Attachment.withSchemaVersion(toVersionX, 2),
        '`schemaVersion` must be a number'
      );
    });

    it('should require an upgrade function', () => {
      assert.throws(
        () => Attachment.withSchemaVersion(2, 3),
        '`upgrade` must be a function'
      );
    });

    it('should skip upgrading if attachment has already been upgraded', async () => {
      const upgrade = async attachment =>
        Object.assign({}, attachment, { foo: true });
      const upgradeWithVersion = Attachment.withSchemaVersion(3, upgrade);

      const input = {
        contentType: 'image/gif',
        data: null,
        fileName: 'foo.gif',
        size: 1111,
        schemaVersion: 4,
      };
      const actual = await upgradeWithVersion(input);
      assert.deepEqual(actual, input);
    });

    it('should return original attachment if upgrade function throws', async () => {
      const upgrade = async () => {
        throw new Error('boom!');
      };
      const upgradeWithVersion = Attachment.withSchemaVersion(3, upgrade);

      const input = {
        contentType: 'image/gif',
        data: null,
        fileName: 'foo.gif',
        size: 1111,
      };
      const actual = await upgradeWithVersion(input);
      assert.deepEqual(actual, input);
    });

    it('should return original attachment if upgrade function returns null', async () => {
      const upgrade = async () => null;
      const upgradeWithVersion = Attachment.withSchemaVersion(3, upgrade);

      const input = {
        contentType: 'image/gif',
        data: null,
        fileName: 'foo.gif',
        size: 1111,
      };
      const actual = await upgradeWithVersion(input);
      assert.deepEqual(actual, input);
    });
  });

  describe('replaceUnicodeOrderOverrides', () => {
    it('should sanitize left-to-right order override character', async () => {
      const input = {
        contentType: 'image/jpeg',
        data: null,
        fileName: 'test\u202Dfig.exe',
        size: 1111,
        schemaVersion: 1,
      };
      const expected = {
        contentType: 'image/jpeg',
        data: null,
        fileName: 'test\uFFFDfig.exe',
        size: 1111,
        schemaVersion: 1,
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
        schemaVersion: 1,
      };
      const expected = {
        contentType: 'image/jpeg',
        data: null,
        fileName: 'test\uFFFDfig.exe',
        size: 1111,
        schemaVersion: 1,
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
        schemaVersion: 1,
      };
      const expected = {
        contentType: 'image/jpeg',
        data: null,
        fileName: 'test\uFFFD\uFFFDlol\uFFFDfig.exe',
        size: 1111,
        schemaVersion: 1,
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
          schemaVersion: 1,
        };

        const actual = Attachment._replaceUnicodeOrderOverridesSync(input);
        assert.deepEqual(actual, input);
      }
    );
  });

  describe('removeSchemaVersion', () => {
    it('should remove existing schema version', async () => {
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

      const actual = await Attachment.removeSchemaVersion(input);
      assert.deepEqual(actual, expected);
    });
  });
});
