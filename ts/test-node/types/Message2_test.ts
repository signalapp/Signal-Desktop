// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';

import * as Message from '../../types/Message2';
import { SignalService } from '../../protobuf';
import * as Bytes from '../../Bytes';
import * as MIME from '../../types/MIME';

import type { EmbeddedContactType } from '../../types/EmbeddedContact';
import type { MessageAttributesType } from '../../model-types.d';
import type { AttachmentType } from '../../types/Attachment';
import type { LoggerType } from '../../types/Logging';

describe('Message', () => {
  const logger: LoggerType = {
    warn: () => null,
    error: () => null,
    fatal: () => null,
    info: () => null,
    debug: () => null,
    trace: () => null,
  };

  function getDefaultMessage(
    props?: Partial<MessageAttributesType>
  ): MessageAttributesType {
    return {
      id: 'some-id',
      type: 'incoming',
      sent_at: 45,
      received_at: 45,
      timestamp: 45,
      conversationId: 'some-conversation-id',
      ...props,
    };
  }

  function getDefaultContext(
    props?: Partial<Message.ContextType>
  ): Message.ContextType {
    return {
      getAbsoluteAttachmentPath: (_path: string) =>
        'fake-absolute-attachment-path',
      getAbsoluteStickerPath: (_path: string) => 'fake-absolute-sticker-path',
      getImageDimensions: async (_params: {
        objectUrl: string;
        logger: LoggerType;
      }) => ({
        width: 10,
        height: 20,
      }),
      getRegionCode: () => 'region-code',
      logger,
      makeImageThumbnail: async (_params: {
        size: number;
        objectUrl: string;
        contentType: MIME.MIMEType;
        logger: LoggerType;
      }) => new Blob(),
      makeObjectUrl: (
        _data: Uint8Array | ArrayBuffer,
        _contentType: MIME.MIMEType
      ) => 'fake-object-url',
      makeVideoScreenshot: async (_params: {
        objectUrl: string;
        contentType: MIME.MIMEType;
        logger: LoggerType;
      }) => new Blob(),
      revokeObjectUrl: (_objectUrl: string) => undefined,
      writeNewAttachmentData: async (_data: Uint8Array) =>
        'fake-attachment-path',
      writeNewStickerData: async (_data: Uint8Array) => 'fake-sticker-path',
      ...props,
    };
  }
  const writeExistingAttachmentData = () => Promise.resolve('path');

  describe('createAttachmentDataWriter', () => {
    it('should ignore messages that didn’t go through attachment migration', async () => {
      const input = getDefaultMessage({
        body: 'Imagine there is no heaven…',
        schemaVersion: 2,
      });
      const expected = getDefaultMessage({
        body: 'Imagine there is no heaven…',
        schemaVersion: 2,
      });

      const actual = await Message.createAttachmentDataWriter({
        writeExistingAttachmentData,
        logger,
      })(input);
      assert.deepEqual(actual, expected);
    });

    it('should ignore messages without attachments', async () => {
      const input = getDefaultMessage({
        body: 'Imagine there is no heaven…',
        schemaVersion: 4,
        attachments: [],
      });
      const expected = getDefaultMessage({
        body: 'Imagine there is no heaven…',
        schemaVersion: 4,
        attachments: [],
      });

      const actual = await Message.createAttachmentDataWriter({
        writeExistingAttachmentData,
        logger,
      })(input);
      assert.deepEqual(actual, expected);
    });

    it('should write attachments to file system on original path', async () => {
      const input = getDefaultMessage({
        body: 'Imagine there is no heaven…',
        schemaVersion: 4,
        attachments: [
          {
            contentType: MIME.IMAGE_GIF,
            size: 3534,
            path: 'ab/abcdefghi',
            data: Bytes.fromString('It’s easy if you try'),
          },
        ],
      });
      const expected = getDefaultMessage({
        body: 'Imagine there is no heaven…',
        schemaVersion: 4,
        attachments: [
          {
            contentType: MIME.IMAGE_GIF,
            size: 3534,
            path: 'ab/abcdefghi',
          },
        ],
        contact: [],
        preview: [],
      });

      // eslint-disable-next-line @typescript-eslint/no-shadow
      const writeExistingAttachmentData = async (
        attachment: Pick<AttachmentType, 'data' | 'path'>
      ) => {
        assert.equal(attachment.path, 'ab/abcdefghi');
        assert.strictEqual(
          Bytes.toString(attachment.data || new Uint8Array()),
          'It’s easy if you try'
        );
        return 'path';
      };

      const actual = await Message.createAttachmentDataWriter({
        writeExistingAttachmentData,
        logger,
      })(input);
      assert.deepEqual(actual, expected);
    });

    it('should process quote attachment thumbnails', async () => {
      const input = getDefaultMessage({
        body: 'Imagine there is no heaven…',
        schemaVersion: 4,
        attachments: [],
        quote: {
          id: 3523,
          isViewOnce: false,
          messageId: 'some-message-id',
          referencedMessageNotFound: false,
          attachments: [
            {
              thumbnail: {
                path: 'ab/abcdefghi',
                data: Bytes.fromString('It’s easy if you try'),
              },
            },
          ],
        },
      });
      const expected = getDefaultMessage({
        body: 'Imagine there is no heaven…',
        schemaVersion: 4,
        attachments: [],
        quote: {
          id: 3523,
          isViewOnce: false,
          messageId: 'some-message-id',
          referencedMessageNotFound: false,
          attachments: [
            {
              thumbnail: {
                path: 'ab/abcdefghi',
              },
            },
          ],
        },
        contact: [],
        preview: [],
      });

      // eslint-disable-next-line @typescript-eslint/no-shadow
      const writeExistingAttachmentData = async (
        attachment: Pick<AttachmentType, 'data' | 'path'>
      ) => {
        assert.equal(attachment.path, 'ab/abcdefghi');
        assert.strictEqual(
          Bytes.toString(attachment.data || new Uint8Array()),
          'It’s easy if you try'
        );
        return 'path';
      };

      const actual = await Message.createAttachmentDataWriter({
        writeExistingAttachmentData,
        logger,
      })(input);
      assert.deepEqual(actual, expected);
    });

    it('should process contact avatars', async () => {
      const input = getDefaultMessage({
        body: 'Imagine there is no heaven…',
        schemaVersion: 4,
        attachments: [],
        contact: [
          {
            name: { givenName: 'john' },
            avatar: {
              isProfile: false,
              avatar: {
                contentType: MIME.IMAGE_PNG,
                size: 47,
                path: 'ab/abcdefghi',
                data: Bytes.fromString('It’s easy if you try'),
              },
            },
          },
        ],
      });
      const expected = getDefaultMessage({
        body: 'Imagine there is no heaven…',
        schemaVersion: 4,
        attachments: [],
        contact: [
          {
            name: { givenName: 'john' },
            avatar: {
              isProfile: false,
              avatar: {
                contentType: MIME.IMAGE_PNG,
                size: 47,
                path: 'ab/abcdefghi',
              },
            },
          },
        ],
        preview: [],
      });

      // eslint-disable-next-line @typescript-eslint/no-shadow
      const writeExistingAttachmentData = async (
        attachment: Pick<AttachmentType, 'data' | 'path'>
      ) => {
        assert.equal(attachment.path, 'ab/abcdefghi');
        assert.strictEqual(
          Bytes.toString(attachment.data || new Uint8Array()),
          'It’s easy if you try'
        );
        return 'path';
      };

      const actual = await Message.createAttachmentDataWriter({
        writeExistingAttachmentData,
        logger,
      })(input);
      assert.deepEqual(actual, expected);
      return 'path';
    });
  });

  describe('initializeSchemaVersion', () => {
    it('should ignore messages with previously inherited schema', () => {
      const input = getDefaultMessage({
        body: 'Imagine there is no heaven…',
        schemaVersion: 2,
      });
      const expected = getDefaultMessage({
        body: 'Imagine there is no heaven…',
        schemaVersion: 2,
      });

      const actual = Message.initializeSchemaVersion({
        message: input,
        logger,
      });
      assert.deepEqual(actual, expected);
    });

    context('for message without attachments', () => {
      it('should initialize schema version to zero', () => {
        const input = getDefaultMessage({
          body: 'Imagine there is no heaven…',
          attachments: [],
        });
        const expected = getDefaultMessage({
          body: 'Imagine there is no heaven…',
          attachments: [],
          schemaVersion: 0,
        });

        const actual = Message.initializeSchemaVersion({
          message: input,
          logger,
        });
        assert.deepEqual(actual, expected);
      });
    });

    context('for message with attachments', () => {
      it('should inherit existing attachment schema version', () => {
        const input = getDefaultMessage({
          body: 'Imagine there is no heaven…',
          attachments: [
            {
              contentType: MIME.IMAGE_JPEG,
              size: 45,
              fileName: 'lennon.jpg',
              schemaVersion: 7,
            },
          ],
        });
        const expected = getDefaultMessage({
          body: 'Imagine there is no heaven…',
          attachments: [
            {
              contentType: MIME.IMAGE_JPEG,
              size: 45,
              fileName: 'lennon.jpg',
            },
          ],
          schemaVersion: 7,
        });

        const actual = Message.initializeSchemaVersion({
          message: input,
          logger,
        });
        assert.deepEqual(actual, expected);
      });
    });
  });

  describe('upgradeSchema', () => {
    it('should upgrade an unversioned message to the latest version', async () => {
      const input = getDefaultMessage({
        attachments: [
          {
            contentType: MIME.AUDIO_AAC,
            flags: SignalService.AttachmentPointer.Flags.VOICE_MESSAGE,
            data: Bytes.fromString('It’s easy if you try'),
            fileName: 'test\u202Dfig.exe',
            size: 1111,
          },
        ],
        schemaVersion: 0,
      });
      const expected = getDefaultMessage({
        attachments: [
          {
            contentType: MIME.AUDIO_AAC,
            flags: 1,
            path: 'abc/abcdefg',
            fileName: 'test\uFFFDfig.exe',
            size: 1111,
            plaintextHash:
              'f191b44995ef464dbf1943bc686008c08e95dab78cbdfe7bb5e257a8214d5b15',
          },
        ],
        hasAttachments: 1,
        hasVisualMediaAttachments: undefined,
        hasFileAttachments: undefined,
        schemaVersion: Message.CURRENT_SCHEMA_VERSION,
        contact: [],
      });

      const expectedAttachmentData = 'It’s easy if you try';
      const context = getDefaultContext({
        writeNewAttachmentData: async attachmentData => {
          assert.strictEqual(
            Bytes.toString(attachmentData),
            expectedAttachmentData
          );
          return 'abc/abcdefg';
        },
      });
      const actual = await Message.upgradeSchema(input, context);
      assert.deepEqual(actual, expected);
    });

    context('with multiple upgrade steps', () => {
      it('should return last valid message when any upgrade step fails', async () => {
        const input = getDefaultMessage({
          attachments: [
            {
              contentType: MIME.APPLICATION_JSON,
              fileName: 'test\u202Dfig.exe',
              size: 1111,
            },
          ],
          body: 'start',
          schemaVersion: 0,
        });
        const expected = getDefaultMessage({
          attachments: [
            {
              contentType: MIME.APPLICATION_JSON,
              fileName: 'test\u202Dfig.exe',
              size: 1111,
            },
          ],
          body: 'start +1',
          schemaVersion: 1,
        });

        const v1 = async (message: MessageAttributesType) => ({
          ...message,
          body: `${message.body} +1`,
        });
        const v2 = async () => {
          throw new Error('boom');
        };
        const v3 = async (message: MessageAttributesType) => ({
          ...message,
          body: `${message.body} +3`,
        });

        const toVersion1 = Message._withSchemaVersion({
          schemaVersion: 1,
          upgrade: v1,
        });
        const toVersion2 = Message._withSchemaVersion({
          schemaVersion: 2,
          upgrade: v2,
        });
        const toVersion3 = Message._withSchemaVersion({
          schemaVersion: 3,
          upgrade: v3,
        });

        const context = getDefaultContext({ logger });
        const upgradeSchema = async (message: MessageAttributesType) =>
          toVersion3(
            await toVersion2(await toVersion1(message, context), context),
            context
          );

        const actual = await upgradeSchema(input);
        assert.deepEqual(actual, expected);
      });

      it('should skip out-of-order upgrade steps', async () => {
        const input = getDefaultMessage({
          attachments: [
            {
              contentType: MIME.APPLICATION_JSON,
              fileName: 'test\u202Dfig.exe',
              size: 1111,
            },
          ],
          body: 'start',
          schemaVersion: 0,
        });
        const expected = getDefaultMessage({
          attachments: [
            {
              contentType: MIME.APPLICATION_JSON,
              fileName: 'test\u202Dfig.exe',
              size: 1111,
            },
          ],
          body: 'start +1 +2',
          schemaVersion: 2,
        });

        const v1 = async (message: MessageAttributesType) => ({
          ...message,
          body: `${message.body} +1`,
        });
        const v2 = async (message: MessageAttributesType) => ({
          ...message,
          body: `${message.body} +2`,
        });
        const v3 = async (message: MessageAttributesType) => ({
          ...message,
          body: `${message.body} +3`,
        });

        const toVersion1 = Message._withSchemaVersion({
          schemaVersion: 1,
          upgrade: v1,
        });
        const toVersion2 = Message._withSchemaVersion({
          schemaVersion: 2,
          upgrade: v2,
        });
        const toVersion3 = Message._withSchemaVersion({
          schemaVersion: 3,
          upgrade: v3,
        });

        const context = getDefaultContext({ logger });
        const atVersion1 = await toVersion1(input, context);

        // Note: this will fail to apply and log, since it's jumping two versions up
        const atVersion3 = await toVersion3(atVersion1, context);

        const actual = await toVersion2(atVersion3, context);
        assert.deepEqual(actual, expected);
      });
    });
  });

  describe('_withSchemaVersion', () => {
    it('should require a version number', () => {
      const toVersionX = () => null;
      assert.throws(
        () =>
          Message._withSchemaVersion({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            schemaVersion: toVersionX as any,
            upgrade: () => Promise.resolve(getDefaultMessage()),
          }),
        '_withSchemaVersion: schemaVersion is invalid'
      );
    });

    it('should require an upgrade function', () => {
      assert.throws(
        () =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          Message._withSchemaVersion({ schemaVersion: 2, upgrade: 3 as any }),
        '_withSchemaVersion: upgrade must be a function'
      );
    });

    it('should skip upgrading if message has already been upgraded', async () => {
      const upgrade = async (message: MessageAttributesType) => ({
        ...message,
        foo: true,
      });
      const upgradeWithVersion = Message._withSchemaVersion({
        schemaVersion: 3,
        upgrade,
      });

      const input = getDefaultMessage({
        id: 'guid-guid-guid-guid',
        schemaVersion: 4,
      });
      const expected = getDefaultMessage({
        id: 'guid-guid-guid-guid',
        schemaVersion: 4,
      });
      const actual = await upgradeWithVersion(
        input,
        getDefaultContext({ logger })
      );
      assert.deepEqual(actual, expected);
    });

    it('should return original message if upgrade function throws', async () => {
      const upgrade = async () => {
        throw new Error('boom!');
      };
      const upgradeWithVersion = Message._withSchemaVersion({
        schemaVersion: 3,
        upgrade,
      });

      const input = getDefaultMessage({
        id: 'guid-guid-guid-guid',
        schemaVersion: 0,
      });
      const expected = getDefaultMessage({
        id: 'guid-guid-guid-guid',
        schemaVersion: 0,
      });
      const actual = await upgradeWithVersion(
        input,
        getDefaultContext({ logger })
      );
      assert.deepEqual(actual, expected);
    });

    it('should return original message if upgrade function returns null', async () => {
      const upgrade = async () => null;
      const upgradeWithVersion = Message._withSchemaVersion({
        schemaVersion: 3,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        upgrade: upgrade as any,
      });

      const input = getDefaultMessage({
        id: 'guid-guid-guid-guid',
        schemaVersion: 0,
      });
      const expected = getDefaultMessage({
        id: 'guid-guid-guid-guid',
        schemaVersion: 0,
      });
      const actual = await upgradeWithVersion(
        input,
        getDefaultContext({ logger })
      );
      assert.deepEqual(actual, expected);
    });
  });

  describe('_mapQuotedAttachments', () => {
    it('handles message with no quote', async () => {
      const upgradeAttachment = sinon
        .stub()
        .throws(new Error("Shouldn't be called"));
      const upgradeVersion = Message._mapQuotedAttachments(upgradeAttachment);

      const message = getDefaultMessage({
        body: 'hey there!',
      });
      const result = await upgradeVersion(message, getDefaultContext());
      assert.deepEqual(result, message);
    });

    it('handles quote with no attachments', async () => {
      const upgradeAttachment = sinon
        .stub()
        .throws(new Error("Shouldn't be called"));
      const upgradeVersion = Message._mapQuotedAttachments(upgradeAttachment);

      const message = getDefaultMessage({
        body: 'hey there!',
        quote: {
          text: 'hey!',
          id: 34233,
          isViewOnce: false,
          messageId: 'message-id',
          referencedMessageNotFound: false,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      });
      const expected = getDefaultMessage({
        body: 'hey there!',
        quote: {
          text: 'hey!',
          attachments: [],
          id: 34233,
          isViewOnce: false,
          messageId: 'message-id',
          referencedMessageNotFound: false,
        },
      });
      const result = await upgradeVersion(
        message,
        getDefaultContext({ logger })
      );
      assert.deepEqual(result, expected);
    });

    it('handles zero attachments', async () => {
      const upgradeAttachment = sinon
        .stub()
        .throws(new Error("Shouldn't be called"));
      const upgradeVersion = Message._mapQuotedAttachments(upgradeAttachment);

      const message = getDefaultMessage({
        body: 'hey there!',
        quote: {
          text: 'hey!',
          attachments: [],
          id: 34233,
          isViewOnce: false,
          messageId: 'message-id',
          referencedMessageNotFound: false,
        },
      });
      const result = await upgradeVersion(
        message,
        getDefaultContext({ logger })
      );
      assert.deepEqual(result, message);
    });

    it('handles attachments with no thumbnail', async () => {
      const upgradeAttachment = sinon
        .stub()
        .throws(new Error("Shouldn't be called"));
      const upgradeVersion = Message._mapQuotedAttachments(upgradeAttachment);

      const message = getDefaultMessage({
        body: 'hey there!',
        quote: {
          text: 'hey!',
          attachments: [
            {
              fileName: 'manifesto.txt',
              contentType: 'text/plain',
            },
          ],
          id: 34233,
          isViewOnce: false,
          messageId: 'message-id',
          referencedMessageNotFound: false,
        },
      });
      const result = await upgradeVersion(
        message,
        getDefaultContext({ logger })
      );
      assert.deepEqual(result, message);
    });

    it('does not eliminate thumbnails with missing data field', async () => {
      const upgradeAttachment = sinon
        .stub()
        .returns({ fileName: 'processed!' });
      const upgradeVersion = Message._mapQuotedAttachments(upgradeAttachment);

      const message = getDefaultMessage({
        body: 'hey there!',
        quote: {
          text: 'hey!',
          attachments: [
            {
              fileName: 'cat.gif',
              contentType: 'image/gif',
              thumbnail: {
                fileName: 'not yet downloaded!',
              },
            },
          ],
          id: 34233,
          isViewOnce: false,
          messageId: 'message-id',
          referencedMessageNotFound: false,
        },
      });
      const expected = getDefaultMessage({
        body: 'hey there!',
        quote: {
          text: 'hey!',
          attachments: [
            {
              contentType: 'image/gif',
              fileName: 'cat.gif',
              thumbnail: {
                fileName: 'processed!',
              },
            },
          ],
          id: 34233,
          isViewOnce: false,
          messageId: 'message-id',
          referencedMessageNotFound: false,
        },
      });
      const result = await upgradeVersion(
        message,
        getDefaultContext({ logger })
      );
      assert.deepEqual(result, expected);
    });

    it('calls provided async function for each quoted attachment', async () => {
      const upgradeAttachment = sinon.stub().resolves({
        path: '/new/path/on/disk',
      });
      const upgradeVersion = Message._mapQuotedAttachments(upgradeAttachment);

      const message = getDefaultMessage({
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
          id: 34233,
          isViewOnce: false,
          messageId: 'message-id',
          referencedMessageNotFound: false,
        },
      });
      const expected = getDefaultMessage({
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
          id: 34233,
          isViewOnce: false,
          messageId: 'message-id',
          referencedMessageNotFound: false,
        },
      });
      const result = await upgradeVersion(
        message,
        getDefaultContext({ logger })
      );
      assert.deepEqual(result, expected);
    });
  });

  describe('_mapContact', () => {
    it('handles message with no contact field', async () => {
      const upgradeContact = sinon
        .stub()
        .throws(new Error("Shouldn't be called"));
      const upgradeVersion = Message._mapContact(upgradeContact);

      const message = getDefaultMessage({
        body: 'hey there!',
      });
      const expected = getDefaultMessage({
        body: 'hey there!',
        contact: [],
      });
      const result = await upgradeVersion(message, getDefaultContext());
      assert.deepEqual(result, expected);
    });

    it('handles one contact', async () => {
      const upgradeContact = (contact: EmbeddedContactType) =>
        Promise.resolve(contact);
      const upgradeVersion = Message._mapContact(upgradeContact);

      const message = getDefaultMessage({
        body: 'hey there!',
        contact: [
          {
            name: {
              displayName: 'Someone somewhere',
            },
          },
        ],
      });
      const expected = getDefaultMessage({
        body: 'hey there!',
        contact: [
          {
            name: {
              displayName: 'Someone somewhere',
            },
          },
        ],
      });
      const result = await upgradeVersion(message, getDefaultContext());
      assert.deepEqual(result, expected);
    });
  });
});
