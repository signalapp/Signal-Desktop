const { assert } = require('chai');
const sinon = require('sinon');

const Message = require('../../../js/modules/types/message');
const { SignalService } = require('../../../ts/protobuf');
const {
  stringToArrayBuffer,
} = require('../../../js/modules/string_to_array_buffer');

describe('Message', () => {
  describe('createAttachmentDataWriter', () => {
    it('should ignore messages that didn’t go through attachment migration', async () => {
      const input = {
        body: 'Imagine there is no heaven…',
        schemaVersion: 2,
      };
      const expected = {
        body: 'Imagine there is no heaven…',
        schemaVersion: 2,
      };
      const writeExistingAttachmentData = () => {};

      const actual = await Message.createAttachmentDataWriter(
        writeExistingAttachmentData
      )(input);
      assert.deepEqual(actual, expected);
    });

    it('should ignore messages without attachments', async () => {
      const input = {
        body: 'Imagine there is no heaven…',
        schemaVersion: 4,
        attachments: [],
      };
      const expected = {
        body: 'Imagine there is no heaven…',
        schemaVersion: 4,
        attachments: [],
      };
      const writeExistingAttachmentData = () => {};

      const actual = await Message.createAttachmentDataWriter(
        writeExistingAttachmentData
      )(input);
      assert.deepEqual(actual, expected);
    });

    it('should write attachments to file system on original path', async () => {
      const input = {
        body: 'Imagine there is no heaven…',
        schemaVersion: 4,
        attachments: [
          {
            path: 'ab/abcdefghi',
            data: stringToArrayBuffer('It’s easy if you try'),
          },
        ],
      };
      const expected = {
        body: 'Imagine there is no heaven…',
        schemaVersion: 4,
        attachments: [
          {
            path: 'ab/abcdefghi',
          },
        ],
        contact: [],
      };

      const writeExistingAttachmentData = attachment => {
        assert.equal(attachment.path, 'ab/abcdefghi');
        assert.deepEqual(
          attachment.data,
          stringToArrayBuffer('It’s easy if you try')
        );
      };

      const actual = await Message.createAttachmentDataWriter(
        writeExistingAttachmentData
      )(input);
      assert.deepEqual(actual, expected);
    });

    it('should process quote attachment thumbnails', async () => {
      const input = {
        body: 'Imagine there is no heaven…',
        schemaVersion: 4,
        attachments: [],
        quote: {
          attachments: [
            {
              thumbnail: {
                path: 'ab/abcdefghi',
                data: stringToArrayBuffer('It’s easy if you try'),
              },
            },
          ],
        },
      };
      const expected = {
        body: 'Imagine there is no heaven…',
        schemaVersion: 4,
        attachments: [],
        quote: {
          attachments: [
            {
              thumbnail: {
                path: 'ab/abcdefghi',
              },
            },
          ],
        },
        contact: [],
      };

      const writeExistingAttachmentData = attachment => {
        assert.equal(attachment.path, 'ab/abcdefghi');
        assert.deepEqual(
          attachment.data,
          stringToArrayBuffer('It’s easy if you try')
        );
      };

      const actual = await Message.createAttachmentDataWriter(
        writeExistingAttachmentData
      )(input);
      assert.deepEqual(actual, expected);
    });

    it('should process contact avatars', async () => {
      const input = {
        body: 'Imagine there is no heaven…',
        schemaVersion: 4,
        attachments: [],
        contact: [
          {
            name: 'john',
            avatar: {
              isProfile: false,
              avatar: {
                path: 'ab/abcdefghi',
                data: stringToArrayBuffer('It’s easy if you try'),
              },
            },
          },
        ],
      };
      const expected = {
        body: 'Imagine there is no heaven…',
        schemaVersion: 4,
        attachments: [],
        contact: [
          {
            name: 'john',
            avatar: {
              isProfile: false,
              avatar: {
                path: 'ab/abcdefghi',
              },
            },
          },
        ],
      };

      const writeExistingAttachmentData = attachment => {
        assert.equal(attachment.path, 'ab/abcdefghi');
        assert.deepEqual(
          attachment.data,
          stringToArrayBuffer('It’s easy if you try')
        );
      };

      const actual = await Message.createAttachmentDataWriter(
        writeExistingAttachmentData
      )(input);
      assert.deepEqual(actual, expected);
    });
  });

  describe('initializeSchemaVersion', () => {
    it('should ignore messages with previously inherited schema', () => {
      const input = {
        body: 'Imagine there is no heaven…',
        schemaVersion: 2,
      };
      const expected = {
        body: 'Imagine there is no heaven…',
        schemaVersion: 2,
      };

      const actual = Message.initializeSchemaVersion(input);
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

        const actual = Message.initializeSchemaVersion(input);
        assert.deepEqual(actual, expected);
      });
    });

    context('for message with attachments', () => {
      it('should inherit existing attachment schema version', () => {
        const input = {
          body: 'Imagine there is no heaven…',
          attachments: [
            {
              contentType: 'image/jpeg',
              fileName: 'lennon.jpg',
              schemaVersion: 7,
            },
          ],
        };
        const expected = {
          body: 'Imagine there is no heaven…',
          attachments: [
            {
              contentType: 'image/jpeg',
              fileName: 'lennon.jpg',
            },
          ],
          schemaVersion: 7,
        };

        const actual = Message.initializeSchemaVersion(input);
        assert.deepEqual(actual, expected);
      });
    });
  });

  describe('upgradeSchema', () => {
    it('should upgrade an unversioned message to the latest version', async () => {
      const input = {
        attachments: [
          {
            contentType: 'audio/aac',
            flags: SignalService.AttachmentPointer.Flags.VOICE_MESSAGE,
            data: stringToArrayBuffer('It’s easy if you try'),
            fileName: 'test\u202Dfig.exe',
            size: 1111,
          },
        ],
        schemaVersion: 0,
      };
      const expected = {
        attachments: [
          {
            contentType: 'audio/aac',
            flags: 1,
            path: 'abc/abcdefg',
            fileName: 'test\uFFFDfig.exe',
            size: 1111,
          },
        ],
        hasAttachments: 1,
        hasVisualMediaAttachments: undefined,
        hasFileAttachments: undefined,
        schemaVersion: Message.CURRENT_SCHEMA_VERSION,
        contact: [],
      };

      const expectedAttachmentData = stringToArrayBuffer(
        'It’s easy if you try'
      );
      const context = {
        writeNewAttachmentData: async attachmentData => {
          assert.deepEqual(attachmentData, expectedAttachmentData);
          return 'abc/abcdefg';
        },
      };
      const actual = await Message.upgradeSchema(input, context);
      assert.deepEqual(actual, expected);
    });

    context('with multiple upgrade steps', () => {
      it('should return last valid message when any upgrade step fails', async () => {
        const input = {
          attachments: [
            {
              contentType: 'application/json',
              data: null,
              fileName: 'test\u202Dfig.exe',
              size: 1111,
            },
          ],
          schemaVersion: 0,
        };
        const expected = {
          attachments: [
            {
              contentType: 'application/json',
              data: null,
              fileName: 'test\u202Dfig.exe',
              size: 1111,
            },
          ],
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

        const toVersion1 = Message._withSchemaVersion(1, v1);
        const toVersion2 = Message._withSchemaVersion(2, v2);
        const toVersion3 = Message._withSchemaVersion(3, v3);

        const upgradeSchema = async message =>
          toVersion3(await toVersion2(await toVersion1(message)));

        const actual = await upgradeSchema(input);
        assert.deepEqual(actual, expected);
      });

      it('should skip out-of-order upgrade steps', async () => {
        const input = {
          attachments: [
            {
              contentType: 'application/json',
              data: null,
              fileName: 'test\u202Dfig.exe',
              size: 1111,
            },
          ],
          schemaVersion: 0,
        };
        const expected = {
          attachments: [
            {
              contentType: 'application/json',
              data: null,
              fileName: 'test\u202Dfig.exe',
              size: 1111,
            },
          ],
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

        const toVersion1 = Message._withSchemaVersion(1, v1);
        const toVersion2 = Message._withSchemaVersion(2, v2);
        const toVersion3 = Message._withSchemaVersion(3, v3);

        // NOTE: We upgrade to 3 before 2, i.e. the pipeline should abort:
        const upgradeSchema = async attachment =>
          toVersion2(await toVersion3(await toVersion1(attachment)));

        const actual = await upgradeSchema(input);
        assert.deepEqual(actual, expected);
      });
    });
  });

  describe('_withSchemaVersion', () => {
    it('should require a version number', () => {
      const toVersionX = () => {};
      assert.throws(
        () => Message._withSchemaVersion(toVersionX, 2),
        "'schemaVersion' is invalid"
      );
    });

    it('should require an upgrade function', () => {
      assert.throws(
        () => Message._withSchemaVersion(2, 3),
        "'upgrade' must be a function"
      );
    });

    it('should skip upgrading if message has already been upgraded', async () => {
      const upgrade = async message =>
        Object.assign({}, message, { foo: true });
      const upgradeWithVersion = Message._withSchemaVersion(3, upgrade);

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
      const upgradeWithVersion = Message._withSchemaVersion(3, upgrade);

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
      const upgradeWithVersion = Message._withSchemaVersion(3, upgrade);

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

  describe('_mapQuotedAttachments', () => {
    it('handles message with no quote', async () => {
      const upgradeAttachment = sinon
        .stub()
        .throws(new Error("Shouldn't be called"));
      const upgradeVersion = Message._mapQuotedAttachments(upgradeAttachment);

      const message = {
        body: 'hey there!',
      };
      const result = await upgradeVersion(message);
      assert.deepEqual(result, message);
    });

    it('handles quote with no attachments', async () => {
      const upgradeAttachment = sinon
        .stub()
        .throws(new Error("Shouldn't be called"));
      const upgradeVersion = Message._mapQuotedAttachments(upgradeAttachment);

      const message = {
        body: 'hey there!',
        quote: {
          text: 'hey!',
        },
      };
      const expected = {
        body: 'hey there!',
        quote: {
          text: 'hey!',
          attachments: [],
        },
      };
      const result = await upgradeVersion(message);
      assert.deepEqual(result, expected);
    });

    it('handles zero attachments', async () => {
      const upgradeAttachment = sinon
        .stub()
        .throws(new Error("Shouldn't be called"));
      const upgradeVersion = Message._mapQuotedAttachments(upgradeAttachment);

      const message = {
        body: 'hey there!',
        quote: {
          text: 'hey!',
          attachments: [],
        },
      };
      const result = await upgradeVersion(message);
      assert.deepEqual(result, message);
    });

    it('handles attachments with no thumbnail', async () => {
      const upgradeAttachment = sinon
        .stub()
        .throws(new Error("Shouldn't be called"));
      const upgradeVersion = Message._mapQuotedAttachments(upgradeAttachment);

      const message = {
        body: 'hey there!',
        quote: {
          text: 'hey!',
          attachments: [],
        },
      };
      const result = await upgradeVersion(message);
      assert.deepEqual(result, message);
    });

    it('eliminates thumbnails with no data field', async () => {
      const upgradeAttachment = sinon
        .stub()
        .throws(new Error("Shouldn't be called"));
      const upgradeVersion = Message._mapQuotedAttachments(upgradeAttachment);

      const message = {
        body: 'hey there!',
        quote: {
          text: 'hey!',
          attachments: [
            {
              fileName: 'cat.gif',
              contentType: 'image/gif',
              thumbnail: {
                fileName: 'failed to download!',
              },
            },
          ],
        },
      };
      const expected = {
        body: 'hey there!',
        quote: {
          text: 'hey!',
          attachments: [
            {
              contentType: 'image/gif',
              fileName: 'cat.gif',
            },
          ],
        },
      };
      const result = await upgradeVersion(message);
      assert.deepEqual(result, expected);
    });

    it('calls provided async function for each quoted attachment', async () => {
      const upgradeAttachment = sinon.stub().resolves({
        path: '/new/path/on/disk',
      });
      const upgradeVersion = Message._mapQuotedAttachments(upgradeAttachment);

      const message = {
        body: 'hey there!',
        quote: {
          text: 'hey!',
          attachments: [
            {
              thumbnail: {
                data: 'data is here',
              },
            },
          ],
        },
      };
      const expected = {
        body: 'hey there!',
        quote: {
          text: 'hey!',
          attachments: [
            {
              thumbnail: {
                path: '/new/path/on/disk',
              },
            },
          ],
        },
      };
      const result = await upgradeVersion(message);
      assert.deepEqual(result, expected);
    });
  });

  describe('_mapContact', () => {
    it('handles message with no contact field', async () => {
      const upgradeContact = sinon
        .stub()
        .throws(new Error("Shouldn't be called"));
      const upgradeVersion = Message._mapContact(upgradeContact);

      const message = {
        body: 'hey there!',
      };
      const expected = {
        body: 'hey there!',
        contact: [],
      };
      const result = await upgradeVersion(message);
      assert.deepEqual(result, expected);
    });

    it('handles one contact', async () => {
      const upgradeContact = contact => Promise.resolve(contact);
      const upgradeVersion = Message._mapContact(upgradeContact);

      const message = {
        body: 'hey there!',
        contact: [
          {
            name: {
              displayName: 'Someone somewhere',
            },
          },
        ],
      };
      const expected = {
        body: 'hey there!',
        contact: [
          {
            name: {
              displayName: 'Someone somewhere',
            },
          },
        ],
      };
      const result = await upgradeVersion(message);
      assert.deepEqual(result, expected);
    });
  });
});
