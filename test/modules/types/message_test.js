const { assert } = require('chai');

const Message = require('../../../js/modules/types/message');


describe('Message', () => {
  describe('inheritSchemaVersion', () => {
    it('should ignore messages with previously inherited schema', () => {
      const input = {
        body: 'Imagine there is no heaven…',
        schemaVersion: 2,
      };
      const expected = {
        body: 'Imagine there is no heaven…',
        schemaVersion: 2,
      };

      const actual = Message.inheritSchemaVersion(input);
      assert.deepEqual(actual, expected);
    });

    context('for message without attachments', () => {
      it('should initialize schema version to zero', () => {
        const input = {
          body: 'Imagine there is no heaven…',
          attachments: [],
        };
        const expected = {
          body: 'Imagine there is no heaven…',
          attachments: [],
          schemaVersion: 0,
        };

        const actual = Message.inheritSchemaVersion(input);
        assert.deepEqual(actual, expected);
      });
    });

    context('for message with attachments', () => {
      it('should inherit existing attachment schema version', () => {
        const input = {
          body: 'Imagine there is no heaven…',
          attachments: [{
            contentType: 'image/jpeg',
            fileName: 'lennon.jpg',
            schemaVersion: 7,
          }],
        };
        const expected = {
          body: 'Imagine there is no heaven…',
          attachments: [{
            contentType: 'image/jpeg',
            fileName: 'lennon.jpg',
          }],
          schemaVersion: 7,
        };

        const actual = Message.inheritSchemaVersion(input);
        assert.deepEqual(actual, expected);
      });
    });
  });

  describe('upgradeSchema', () => {
    it('should upgrade an unversioned message to the latest version', async () => {
      const input = {
        attachments: [{
          contentType: 'application/json',
          data: null,
          fileName: 'test\u202Dfig.exe',
          size: 1111,
        }],
        schemaVersion: 0,
      };
      const expected = {
        attachments: [{
          contentType: 'application/json',
          data: null,
          fileName: 'test\uFFFDfig.exe',
          size: 1111,
        }],
        schemaVersion: Message.CURRENT_SCHEMA_VERSION,
      };

      const actual = await Message.upgradeSchema(input);
      assert.deepEqual(actual, expected);
    });

    context('with multiple upgrade steps', () => {
      it('should return last valid message when any upgrade step fails', async () => {
        const input = {
          attachments: [{
            contentType: 'application/json',
            data: null,
            fileName: 'test\u202Dfig.exe',
            size: 1111,
          }],
          schemaVersion: 0,
        };
        const expected = {
          attachments: [{
            contentType: 'application/json',
            data: null,
            fileName: 'test\u202Dfig.exe',
            size: 1111,
          }],
          hasUpgradedToVersion1: true,
          schemaVersion: 1,
        };

        const v1 = async message =>
          Object.assign({}, message, { hasUpgradedToVersion1: true });
        const v2 = async () => {
          throw new Error('boom');
        };
        const v3 = async message =>
          Object.assign({}, message, { hasUpgradedToVersion3: true });

        const toVersion1 = Message.withSchemaVersion(1, v1);
        const toVersion2 = Message.withSchemaVersion(2, v2);
        const toVersion3 = Message.withSchemaVersion(3, v3);

        const upgradeSchema = async message =>
          toVersion3(await toVersion2(await toVersion1(message)));

        const actual = await upgradeSchema(input);
        assert.deepEqual(actual, expected);
      });

      it('should skip out-of-order upgrade steps', async () => {
        const input = {
          attachments: [{
            contentType: 'application/json',
            data: null,
            fileName: 'test\u202Dfig.exe',
            size: 1111,
          }],
          schemaVersion: 0,
        };
        const expected = {
          attachments: [{
            contentType: 'application/json',
            data: null,
            fileName: 'test\u202Dfig.exe',
            size: 1111,
          }],
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

        const toVersion1 = Message.withSchemaVersion(1, v1);
        const toVersion2 = Message.withSchemaVersion(2, v2);
        const toVersion3 = Message.withSchemaVersion(3, v3);

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
        () => Message.withSchemaVersion(toVersionX, 2),
        '`schemaVersion` is invalid'
      );
    });

    it('should require an upgrade function', () => {
      assert.throws(
        () => Message.withSchemaVersion(2, 3),
        '`upgrade` must be a function'
      );
    });

    it('should skip upgrading if message has already been upgraded', async () => {
      const upgrade = async message =>
        Object.assign({}, message, { foo: true });
      const upgradeWithVersion = Message.withSchemaVersion(3, upgrade);

      const input = {
        id: 'guid-guid-guid-guid',
        schemaVersion: 4,
      };
      const expected = {
        id: 'guid-guid-guid-guid',
        schemaVersion: 4,
      };
      const actual = await upgradeWithVersion(input);
      assert.deepEqual(actual, expected);
    });

    it('should return original message if upgrade function throws', async () => {
      const upgrade = async () => {
        throw new Error('boom!');
      };
      const upgradeWithVersion = Message.withSchemaVersion(3, upgrade);

      const input = {
        id: 'guid-guid-guid-guid',
        schemaVersion: 0,
      };
      const expected = {
        id: 'guid-guid-guid-guid',
        schemaVersion: 0,
      };
      const actual = await upgradeWithVersion(input);
      assert.deepEqual(actual, expected);
    });

    it('should return original message if upgrade function returns null', async () => {
      const upgrade = async () => null;
      const upgradeWithVersion = Message.withSchemaVersion(3, upgrade);

      const input = {
        id: 'guid-guid-guid-guid',
        schemaVersion: 0,
      };
      const expected = {
        id: 'guid-guid-guid-guid',
        schemaVersion: 0,
      };
      const actual = await upgradeWithVersion(input);
      assert.deepEqual(actual, expected);
    });
  });
});
