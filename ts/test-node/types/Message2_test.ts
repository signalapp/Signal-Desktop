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
import type {
  AddressableAttachmentType,
  AttachmentType,
  LocalAttachmentV2Type,
} from '../../types/Attachment';
import type { LoggerType } from '../../types/Logging';

const FAKE_LOCAL_ATTACHMENT: LocalAttachmentV2Type = {
  version: 2,
  size: 1,
  plaintextHash: 'bogus',
  path: 'fake',
  localKey: 'absent',
};

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
      getImageDimensions: async (_params: {
        objectUrl: string;
        logger: LoggerType;
      }) => ({
        width: 10,
        height: 20,
      }),
      doesAttachmentExist: async () => true,
      // @ts-expect-error ensureAttachmentIsReencryptable has type guards that we don't
      // implement here
      ensureAttachmentIsReencryptable: async attachment => attachment,
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
      readAttachmentData: async (
        attachment: Partial<AddressableAttachmentType>
      ): Promise<Uint8Array> => {
        assert.strictEqual(attachment.version, 2);
        return Buffer.from('old data');
      },
      writeNewAttachmentData: async (_data: Uint8Array) => {
        return FAKE_LOCAL_ATTACHMENT;
      },
      writeNewStickerData: async (_data: Uint8Array) => ({
        version: 2,
        path: 'fake-sticker-path',
        size: 1,
        localKey: '123',
        plaintextHash: 'hash',
      }),
      deleteOnDisk: async (_path: string) => undefined,
      ...props,
    };
  }

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
        });
        const expected = getDefaultMessage({
          body: 'Imagine there is no heaven…',
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
            ...FAKE_LOCAL_ATTACHMENT,
            contentType: MIME.AUDIO_AAC,
            flags: 1,
            fileName: 'test\uFFFDfig.exe',
          },
        ],
        hasAttachments: 1,
        hasVisualMediaAttachments: undefined,
        hasFileAttachments: undefined,
        schemaVersion: Message.CURRENT_SCHEMA_VERSION,
      });

      const expectedAttachmentData = 'It’s easy if you try';
      const context = getDefaultContext({
        writeNewAttachmentData: async attachmentData => {
          assert.strictEqual(
            Bytes.toString(attachmentData),
            expectedAttachmentData
          );
          return FAKE_LOCAL_ATTACHMENT;
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

        const actual = await Message.upgradeSchema(input, getDefaultContext(), {
          versions: [toVersion1, toVersion2, toVersion3],
        });
        assert.deepEqual(actual, expected);

        // if we try to upgrade it again, it will fail since it could not upgrade any
        // versions
        const upgradeAgainPromise = Message.upgradeSchema(
          actual,
          getDefaultContext(),
          { versions: [toVersion1, toVersion2, toVersion3] }
        );
        await assert.isRejected(upgradeAgainPromise);
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

    it('should throw if upgrade function throws', async () => {
      const upgrade = async () => {
        throw new Error('boom!');
      };
      const upgradeWithVersion = Message._withSchemaVersion({
        schemaVersion: 1,
        upgrade,
      });

      const input = getDefaultMessage({
        id: 'guid-guid-guid-guid',
        schemaVersion: 0,
      });

      const upgradePromise = upgradeWithVersion(
        input,
        getDefaultContext({ logger })
      );
      await assert.isRejected(upgradePromise);
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
              contentType: MIME.TEXT_ATTACHMENT,
            },
          ],
          id: 34233,
          isViewOnce: false,
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
        .returns({ contentType: MIME.IMAGE_GIF, size: 42 });
      const upgradeVersion = Message._mapQuotedAttachments(upgradeAttachment);

      const message = getDefaultMessage({
        body: 'hey there!',
        quote: {
          text: 'hey!',
          attachments: [
            {
              fileName: 'cat.gif',
              contentType: MIME.IMAGE_GIF,
              thumbnail: {
                contentType: MIME.IMAGE_GIF,
                size: 128,
              },
            },
          ],
          id: 34233,
          isViewOnce: false,
          referencedMessageNotFound: false,
        },
      });
      const expected = getDefaultMessage({
        body: 'hey there!',
        quote: {
          text: 'hey!',
          attachments: [
            {
              contentType: MIME.IMAGE_GIF,
              fileName: 'cat.gif',
              thumbnail: {
                contentType: MIME.IMAGE_GIF,
                size: 42,
              },
            },
          ],
          id: 34233,
          isViewOnce: false,
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
        contentType: MIME.TEXT_ATTACHMENT,
        size: 100,
      });
      const upgradeVersion = Message._mapQuotedAttachments(upgradeAttachment);

      const message = getDefaultMessage({
        body: 'hey there!',
        quote: {
          text: 'hey!',
          attachments: [
            {
              contentType: MIME.TEXT_ATTACHMENT,
              thumbnail: {
                contentType: MIME.TEXT_ATTACHMENT,
                size: 100,
                data: Buffer.from('data is here'),
              },
            },
          ],
          id: 34233,
          isViewOnce: false,
          referencedMessageNotFound: false,
        },
      });
      const expected = getDefaultMessage({
        body: 'hey there!',
        quote: {
          text: 'hey!',
          attachments: [
            {
              contentType: MIME.TEXT_ATTACHMENT,
              thumbnail: {
                contentType: MIME.TEXT_ATTACHMENT,
                size: 100,
                path: '/new/path/on/disk',
              },
            },
          ],
          id: 34233,
          isViewOnce: false,
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
              nickname: 'Someone somewhere',
            },
          },
        ],
      });
      const expected = getDefaultMessage({
        body: 'hey there!',
        contact: [
          {
            name: {
              nickname: 'Someone somewhere',
            },
          },
        ],
      });
      const result = await upgradeVersion(message, getDefaultContext());
      assert.deepEqual(result, expected);
    });
  });

  describe('_mapAllAttachments', () => {
    function composeAttachment(
      overrides?: Partial<AttachmentType>
    ): AttachmentType {
      return {
        size: 128,
        contentType: MIME.IMAGE_JPEG,
        ...overrides,
      };
    }

    it('updates all attachments on message', async () => {
      const upgradeAttachment = (attachment: AttachmentType) =>
        Promise.resolve({ ...attachment, key: 'upgradedKey' });

      const upgradeVersion = Message._mapAllAttachments(upgradeAttachment);

      const message = getDefaultMessage({
        body: 'hey there!',
        attachments: [
          composeAttachment({ path: '/attachment/1' }),
          composeAttachment({ path: '/attachment/2' }),
        ],
        quote: {
          text: 'quote!',
          attachments: [
            {
              contentType: MIME.TEXT_ATTACHMENT,
              thumbnail: composeAttachment({ path: 'quoted/thumbnail' }),
            },
          ],
          id: 34233,
          isViewOnce: false,
          referencedMessageNotFound: false,
        },
        preview: [
          { url: 'url', image: composeAttachment({ path: 'preview/image' }) },
        ],
        contact: [
          {
            avatar: {
              isProfile: false,
              avatar: composeAttachment({ path: 'contact/avatar' }),
            },
          },
        ],
        sticker: {
          packId: 'packId',
          stickerId: 1,
          packKey: 'packKey',
          data: composeAttachment({ path: 'sticker/data' }),
        },
        bodyAttachment: composeAttachment({ path: 'body/attachment' }),
      });

      const expected = getDefaultMessage({
        body: 'hey there!',
        attachments: [
          composeAttachment({ path: '/attachment/1', key: 'upgradedKey' }),
          composeAttachment({ path: '/attachment/2', key: 'upgradedKey' }),
        ],
        quote: {
          text: 'quote!',
          attachments: [
            {
              contentType: MIME.TEXT_ATTACHMENT,
              thumbnail: composeAttachment({
                path: 'quoted/thumbnail',
                key: 'upgradedKey',
              }),
            },
          ],
          id: 34233,
          isViewOnce: false,
          referencedMessageNotFound: false,
        },
        preview: [
          {
            url: 'url',
            image: composeAttachment({
              path: 'preview/image',
              key: 'upgradedKey',
            }),
          },
        ],
        contact: [
          {
            avatar: {
              isProfile: false,
              avatar: composeAttachment({
                path: 'contact/avatar',
                key: 'upgradedKey',
              }),
            },
          },
        ],
        sticker: {
          packId: 'packId',
          stickerId: 1,
          packKey: 'packKey',
          data: composeAttachment({ path: 'sticker/data', key: 'upgradedKey' }),
        },
        bodyAttachment: composeAttachment({
          path: 'body/attachment',
          key: 'upgradedKey',
        }),
      });
      const result = await upgradeVersion(message, getDefaultContext());
      assert.deepEqual(result, expected);
    });
  });
  describe('migrateBodyAttachmentToDisk', () => {
    it('writes long text attachment to disk, but does not truncate body', async () => {
      const message = getDefaultMessage({
        body: 'a'.repeat(3000),
      });
      const expected = getDefaultMessage({
        body: 'a'.repeat(3000),
        bodyAttachment: {
          contentType: MIME.LONG_MESSAGE,
          ...FAKE_LOCAL_ATTACHMENT,
        },
      });
      const result = await Message.migrateBodyAttachmentToDisk(
        message,
        getDefaultContext()
      );
      assert.deepEqual(result, expected);
    });
    it('does nothing if body is not too long', async () => {
      const message = getDefaultMessage({
        body: 'a'.repeat(2048),
      });

      const result = await Message.migrateBodyAttachmentToDisk(
        message,
        getDefaultContext()
      );
      assert.deepEqual(result, message);
    });
  });

  describe('toVersion14: ensureAttachmentsAreReencryptable', () => {
    it('migrates message if the file does not exist', async () => {
      const message = getDefaultMessage({
        schemaVersion: 13,
        schemaMigrationAttempts: 0,
        attachments: [
          {
            size: 128,
            contentType: MIME.IMAGE_BMP,
            path: 'no/file/here.png',
            iv: 'iv',
            digest: 'digest',
            key: 'key',
          },
        ],
      });
      const result = await Message.upgradeSchema(message, {
        ...getDefaultContext(),
        doesAttachmentExist: async () => false,
      });

      assert.deepEqual({ ...message, schemaVersion: 14 }, result);
    });
  });
});
