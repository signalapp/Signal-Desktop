// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { v4 as generateGuid } from 'uuid';
import { BackupLevel } from '@signalapp/libsignal-client/zkgroup';
import { omit } from 'lodash';
import * as sinon from 'sinon';
import { join } from 'path';
import { assert } from 'chai';

import type { ConversationModel } from '../../models/conversations';
import * as Bytes from '../../Bytes';
import { DataWriter } from '../../sql/Client';
import { type AciString, generateAci } from '../../types/ServiceId';
import { ReadStatus } from '../../messages/MessageReadStatus';
import { SeenStatus } from '../../MessageSeenStatus';
import { setupBasics, asymmetricRoundtripHarness } from './helpers';
import {
  AUDIO_MP3,
  IMAGE_JPEG,
  IMAGE_PNG,
  IMAGE_WEBP,
  LONG_MESSAGE,
  VIDEO_MP4,
} from '../../types/MIME';
import type {
  MessageAttributesType,
  QuotedMessageType,
} from '../../model-types';
import {
  hasRequiredInformationForBackup,
  isVoiceMessage,
  type AttachmentType,
} from '../../types/Attachment';
import { strictAssert } from '../../util/assert';
import { SignalService } from '../../protobuf';
import { getRandomBytes } from '../../Crypto';
import { loadAllAndReinitializeRedux } from '../../services/allLoaders';
import {
  generateAttachmentKeys,
  generateKeys,
  getPlaintextHashForInMemoryAttachment,
} from '../../AttachmentCrypto';
import { KIBIBYTE } from '../../types/AttachmentSize';

const CONTACT_A = generateAci();

const NON_ROUNDTRIPPED_FIELDS = ['path', 'thumbnail', 'screenshot', 'localKey'];

describe('backup/attachments', () => {
  let sandbox: sinon.SinonSandbox;
  let contactA: ConversationModel;

  beforeEach(async () => {
    await DataWriter.removeAll();
    window.storage.reset();

    window.ConversationController.reset();

    await setupBasics();

    contactA = await window.ConversationController.getOrCreateAndWait(
      CONTACT_A,
      'private',
      { systemGivenName: 'CONTACT_A', active_at: 1 }
    );

    await loadAllAndReinitializeRedux();

    sandbox = sinon.createSandbox();
    const getAbsoluteAttachmentPath = sandbox.stub(
      window.Signal.Migrations,
      'getAbsoluteAttachmentPath'
    );
    getAbsoluteAttachmentPath.callsFake(path => {
      if (path === 'path/to/sticker') {
        return join(__dirname, '../../../fixtures/kitten-3-64-64.jpg');
      }
      if (path === 'path/to/thumbnail') {
        return join(__dirname, '../../../fixtures/kitten-3-64-64.jpg');
      }
      return getAbsoluteAttachmentPath.wrappedMethod(path);
    });
  });

  afterEach(async () => {
    await DataWriter.removeAll();

    sandbox.restore();
  });

  function composeAttachment(
    index: number,
    overrides?: Partial<AttachmentType>
  ): AttachmentType {
    return {
      cdnKey: `cdnKey${index}`,
      cdnNumber: 3,
      clientUuid: generateGuid(),
      plaintextHash: Bytes.toHex(getRandomBytes(32)),
      key: Bytes.toBase64(generateKeys()),
      digest: Bytes.toBase64(getRandomBytes(32)),
      size: 100,
      contentType: IMAGE_JPEG,
      path: `/path/to/file${index}.png`,
      caption: `caption${index}`,
      localKey: Bytes.toBase64(generateAttachmentKeys()),
      uploadTimestamp: index,
      thumbnail: {
        size: 1024,
        width: 150,
        height: 150,
        contentType: IMAGE_PNG,
        path: 'path/to/thumbnail',
      },
      ...overrides,
    };
  }

  function composeMessage(
    timestamp: number,
    overrides?: Partial<MessageAttributesType>
  ): MessageAttributesType {
    return {
      conversationId: contactA.id,
      id: generateGuid(),
      type: 'incoming',
      received_at: timestamp,
      received_at_ms: timestamp,
      sourceServiceId: CONTACT_A,
      sourceDevice: 1,
      schemaVersion: 0,
      sent_at: timestamp,
      timestamp,
      readStatus: ReadStatus.Read,
      seenStatus: SeenStatus.Seen,
      unidentifiedDeliveryReceived: true,
      ...overrides,
    };
  }

  function expectedRoundtrippedFields(
    attachment: AttachmentType
  ): AttachmentType {
    const base = omit(attachment, NON_ROUNDTRIPPED_FIELDS);
    if (hasRequiredInformationForBackup(attachment)) {
      delete base.digest;
    } else {
      delete base.plaintextHash;
    }
    return base;
  }

  describe('long-message attachments', () => {
    it('preserves attachment still on message.attachments', async () => {
      const longMessageAttachment = composeAttachment(1, {
        contentType: LONG_MESSAGE,
      });
      const normalAttachment = composeAttachment(2);

      strictAssert(longMessageAttachment.digest, 'digest exists');
      strictAssert(normalAttachment.digest, 'digest exists');

      await asymmetricRoundtripHarness(
        [
          composeMessage(1, {
            attachments: [longMessageAttachment, normalAttachment],
            schemaVersion: 12,
          }),
        ],
        [
          composeMessage(1, {
            attachments: [
              expectedRoundtrippedFields(longMessageAttachment),
              expectedRoundtrippedFields(normalAttachment),
            ],
          }),
        ]
      );
    });
    it('migration creates long-message attachment if there is a long message.body (i.e. schemaVersion < 13)', async () => {
      const body = 'a'.repeat(3000);
      const bodyBytes = Bytes.fromString(body);
      await asymmetricRoundtripHarness(
        [
          composeMessage(1, {
            body,
            schemaVersion: 12,
          }),
        ],
        [
          composeMessage(1, {
            body,
            bodyAttachment: {
              contentType: LONG_MESSAGE,
              size: bodyBytes.byteLength,
              plaintextHash: getPlaintextHashForInMemoryAttachment(bodyBytes),
            },
          }),
        ],
        {
          backupLevel: BackupLevel.Paid,
          comparator: (expected, msgInDB) => {
            assert.deepStrictEqual(
              omit(expected, 'bodyAttachment'),
              omit(msgInDB, 'bodyAttachment')
            );

            assert.deepStrictEqual(
              expected.bodyAttachment,
              omit(msgInDB.bodyAttachment, ['localKey', 'path', 'version'])
            );

            assert.isUndefined(msgInDB.bodyAttachment?.digest);
          },
        }
      );
    });

    it('handles existing bodyAttachments', async () => {
      const body = 'a'.repeat(3000);
      const bodyBytes = Bytes.fromString(body);

      const attachment = omit(
        composeAttachment(1, {
          contentType: LONG_MESSAGE,
          size: bodyBytes.byteLength,
          downloadPath: 'downloadPath',
        }),
        'thumbnail'
      );
      strictAssert(attachment.digest, 'must exist');

      await asymmetricRoundtripHarness(
        [
          composeMessage(1, {
            bodyAttachment: attachment,
            body,
          }),
        ],
        [
          composeMessage(1, {
            body,
            bodyAttachment: {
              contentType: LONG_MESSAGE,
              size: 3000,
              plaintextHash: getPlaintextHashForInMemoryAttachment(bodyBytes),
            },
          }),
        ],
        {
          backupLevel: BackupLevel.Paid,
          comparator: (expected, msgInDB) => {
            assert.deepStrictEqual(
              omit(expected, 'bodyAttachment'),
              omit(msgInDB, 'bodyAttachment')
            );

            assert.deepStrictEqual(
              expected.bodyAttachment,
              omit(msgInDB.bodyAttachment, ['localKey', 'path', 'version'])
            );
          },
        }
      );
    });
    it('truncates at 128 KiB', async () => {
      const body = 'a'.repeat(129 * KIBIBYTE);
      const truncatedBody = body.slice(0, 128 * KIBIBYTE);
      const bodyBytes = Bytes.fromString(body);

      const attachment = omit(
        composeAttachment(1, {
          contentType: LONG_MESSAGE,
          size: bodyBytes.byteLength,
          downloadPath: 'downloadPath',
        }),
        'thumbnail'
      );
      strictAssert(attachment.digest, 'must exist');

      await asymmetricRoundtripHarness(
        [
          composeMessage(1, {
            bodyAttachment: attachment,
            body,
          }),
        ],
        [
          composeMessage(1, {
            body: truncatedBody,
            bodyAttachment: {
              contentType: LONG_MESSAGE,
              size: 128 * KIBIBYTE,
              plaintextHash: getPlaintextHashForInMemoryAttachment(
                Bytes.fromString(truncatedBody)
              ),
            },
          }),
        ],
        {
          backupLevel: BackupLevel.Paid,
          comparator: (expected, msgInDB) => {
            assert.deepStrictEqual(
              omit(expected, 'bodyAttachment'),
              omit(msgInDB, 'bodyAttachment')
            );

            assert.deepStrictEqual(
              expected.bodyAttachment,
              omit(msgInDB.bodyAttachment, ['localKey', 'path', 'version'])
            );
          },
        }
      );
    });
    it('includes bodyAttachment if it has not downloaded', async () => {
      const truncatedBody = 'a'.repeat(2 * KIBIBYTE);

      const attachment = omit(
        composeAttachment(1, {
          contentType: LONG_MESSAGE,
          size: 64 * KIBIBYTE,
          path: undefined,
          plaintextHash: undefined,
          localKey: undefined,
          downloadPath: undefined,
          clientUuid: undefined, // clientUuids are not roundtripped for bodyAttachments
        }),
        'thumbnail'
      );
      strictAssert(attachment.digest, 'must exist');

      await asymmetricRoundtripHarness(
        [
          composeMessage(1, {
            body: truncatedBody,
            bodyAttachment: attachment,
          }),
        ],
        [
          composeMessage(1, {
            body: truncatedBody,
            bodyAttachment: attachment,
          }),
        ],
        {
          backupLevel: BackupLevel.Paid,
          comparator: (expected, msgInDB) => {
            assert.deepStrictEqual(
              omit(msgInDB, 'bodyAttachment'),
              omit(expected, 'bodyAttachment')
            );

            assert.deepStrictEqual(
              omit(msgInDB.bodyAttachment, ['downloadPath']),
              expected.bodyAttachment
            );
          },
        }
      );
    });
  });

  describe('normal attachments', () => {
    it('BackupLevel.Free, roundtrips normal attachments', async () => {
      const attachment1 = composeAttachment(1);
      const attachment2 = composeAttachment(2);

      await asymmetricRoundtripHarness(
        [
          composeMessage(1, {
            attachments: [attachment1, attachment2],
          }),
        ],
        [
          composeMessage(1, {
            attachments: [
              expectedRoundtrippedFields(attachment1),
              expectedRoundtrippedFields(attachment2),
            ],
          }),
        ],
        { backupLevel: BackupLevel.Free }
      );
    });
    it('BackupLevel.Paid, roundtrips normal attachments', async () => {
      const attachment = composeAttachment(1);
      strictAssert(attachment.digest, 'digest exists');

      await asymmetricRoundtripHarness(
        [
          composeMessage(1, {
            attachments: [attachment],
          }),
        ],
        [
          composeMessage(1, {
            attachments: [expectedRoundtrippedFields(attachment)],
          }),
        ],
        { backupLevel: BackupLevel.Paid }
      );
    });
    it('deduplicates attachments on export based on mediaName', async () => {
      const attachment1 = composeAttachment(1);
      const attachment2 = {
        ...attachment1,
        contentType: IMAGE_WEBP,
        caption: 'attachment2caption',
        cdnKey: 'attachment2cdnkey',
        cdnNumber: 25,
      };

      await asymmetricRoundtripHarness(
        [
          composeMessage(1, {
            attachments: [attachment1],
          }),
          composeMessage(2, {
            attachments: [attachment2],
          }),
        ],
        [
          composeMessage(1, {
            attachments: [expectedRoundtrippedFields(attachment1)],
          }),
          composeMessage(2, {
            attachments: [
              expectedRoundtrippedFields({
                ...attachment2,
                cdnKey: attachment1.cdnKey,
                cdnNumber: attachment1.cdnNumber,
              }),
            ],
          }),
        ],
        { backupLevel: BackupLevel.Paid }
      );
    });
    it('roundtrips voice message attachments', async () => {
      const attachment = composeAttachment(1);
      attachment.contentType = AUDIO_MP3;
      attachment.flags = SignalService.AttachmentPointer.Flags.VOICE_MESSAGE;

      strictAssert(isVoiceMessage(attachment), 'it is a voice attachment');
      strictAssert(attachment.digest, 'digest exists');

      await asymmetricRoundtripHarness(
        [
          composeMessage(1, {
            attachments: [attachment],
          }),
        ],
        [
          composeMessage(1, {
            attachments: [expectedRoundtrippedFields(attachment)],
          }),
        ],
        { backupLevel: BackupLevel.Paid }
      );
    });
    it('drops voice message flag when body is present', async () => {
      const attachment = composeAttachment(1);
      attachment.contentType = AUDIO_MP3;
      attachment.flags = SignalService.AttachmentPointer.Flags.VOICE_MESSAGE;

      strictAssert(isVoiceMessage(attachment), 'it is a voice attachment');
      strictAssert(attachment.digest, 'digest exists');

      await asymmetricRoundtripHarness(
        [
          composeMessage(1, {
            body: 'hello',
            attachments: [attachment],
          }),
        ],
        [
          composeMessage(1, {
            body: 'hello',
            attachments: [
              {
                ...expectedRoundtrippedFields(attachment),
                flags: undefined,
              },
            ],
          }),
        ],
        { backupLevel: BackupLevel.Paid }
      );
    });
  });

  describe('Preview attachments', () => {
    it('BackupLevel.Free, roundtrips preview attachments', async () => {
      const attachment = composeAttachment(1, { clientUuid: undefined });

      await asymmetricRoundtripHarness(
        [
          composeMessage(1, {
            body: 'https://signal.org',
            preview: [
              { url: 'https://signal.org', date: 1, image: attachment },
            ],
          }),
        ],
        [
          composeMessage(1, {
            body: 'https://signal.org',
            preview: [
              {
                url: 'https://signal.org',
                date: 1,
                image: expectedRoundtrippedFields(attachment),
              },
            ],
          }),
        ],
        { backupLevel: BackupLevel.Free }
      );
    });
    it('BackupLevel.Paid, roundtrips preview attachments', async () => {
      const attachment = composeAttachment(1, { clientUuid: undefined });
      strictAssert(attachment.digest, 'digest exists');

      await asymmetricRoundtripHarness(
        [
          composeMessage(1, {
            body: 'https://signal.org',
            preview: [
              {
                url: 'https://signal.org',
                date: 1,
                title: 'title',
                description: 'description',
                image: attachment,
              },
            ],
          }),
        ],
        [
          composeMessage(1, {
            body: 'https://signal.org',
            preview: [
              {
                url: 'https://signal.org',
                date: 1,
                title: 'title',
                description: 'description',
                image: expectedRoundtrippedFields(attachment),
              },
            ],
          }),
        ],
        { backupLevel: BackupLevel.Paid }
      );
    });
  });

  describe('contact attachments', () => {
    it('BackupLevel.Free, roundtrips contact attachments', async () => {
      const attachment = composeAttachment(1, { clientUuid: undefined });

      await asymmetricRoundtripHarness(
        [
          composeMessage(1, {
            contact: [{ avatar: { avatar: attachment, isProfile: false } }],
          }),
        ],
        // path & iv will not be roundtripped
        [
          composeMessage(1, {
            contact: [
              {
                avatar: {
                  avatar: expectedRoundtrippedFields(attachment),
                  isProfile: false,
                },
              },
            ],
          }),
        ],
        { backupLevel: BackupLevel.Free }
      );
    });
    it('BackupLevel.Paid, roundtrips contact attachments', async () => {
      const attachment = composeAttachment(1, { clientUuid: undefined });
      strictAssert(attachment.digest, 'digest exists');

      await asymmetricRoundtripHarness(
        [
          composeMessage(1, {
            contact: [{ avatar: { avatar: attachment, isProfile: false } }],
          }),
        ],
        [
          composeMessage(1, {
            contact: [
              {
                avatar: {
                  avatar: expectedRoundtrippedFields(attachment),
                  isProfile: false,
                },
              },
            ],
          }),
        ],
        { backupLevel: BackupLevel.Paid }
      );
    });
  });

  describe('quotes', () => {
    it('BackupLevel.Free, roundtrips quote attachments', async () => {
      const attachment = composeAttachment(1, { clientUuid: undefined });
      const authorAci = generateAci();
      const quotedMessage: QuotedMessageType = {
        authorAci,
        isViewOnce: false,
        id: Date.now(),
        referencedMessageNotFound: false,
        isGiftBadge: true,
        attachments: [{ thumbnail: attachment, contentType: VIDEO_MP4 }],
      };

      await asymmetricRoundtripHarness(
        [
          composeMessage(1, {
            body: '123',
            quote: quotedMessage,
          }),
        ],
        // path & iv will not be roundtripped
        [
          composeMessage(1, {
            body: '123',
            quote: {
              ...quotedMessage,
              attachments: [
                {
                  thumbnail: expectedRoundtrippedFields(attachment),
                  contentType: VIDEO_MP4,
                },
              ],
            },
          }),
        ],
        { backupLevel: BackupLevel.Free }
      );
    });
    it('BackupLevel.Paid, roundtrips quote attachments', async () => {
      const attachment = composeAttachment(1, { clientUuid: undefined });
      strictAssert(attachment.digest, 'digest exists');
      const authorAci = generateAci();
      const quotedMessage: QuotedMessageType = {
        authorAci,
        isViewOnce: false,
        id: Date.now(),
        referencedMessageNotFound: false,
        isGiftBadge: true,
        attachments: [{ thumbnail: attachment, contentType: VIDEO_MP4 }],
      };

      await asymmetricRoundtripHarness(
        [
          composeMessage(1, {
            body: '123',
            quote: quotedMessage,
          }),
        ],
        [
          composeMessage(1, {
            body: '123',
            quote: {
              ...quotedMessage,
              attachments: [
                {
                  thumbnail: expectedRoundtrippedFields(attachment),
                  contentType: VIDEO_MP4,
                },
              ],
            },
          }),
        ],
        { backupLevel: BackupLevel.Paid }
      );
    });

    it('Copies data from message if it exists', async () => {
      const existingAttachment = composeAttachment(1);
      const existingMessageTimestamp = Date.now();
      const existingMessage = composeMessage(existingMessageTimestamp, {
        body: '123',
        attachments: [existingAttachment],
      });

      const quoteAttachment = composeAttachment(2, { clientUuid: undefined });
      delete quoteAttachment.thumbnail;

      strictAssert(quoteAttachment.digest, 'digest exists');
      strictAssert(existingAttachment.digest, 'digest exists');
      const quotedMessage: QuotedMessageType = {
        authorAci: existingMessage.sourceServiceId as AciString,
        isViewOnce: false,
        id: existingMessageTimestamp,
        referencedMessageNotFound: false,
        isGiftBadge: false,
        attachments: [{ thumbnail: quoteAttachment, contentType: VIDEO_MP4 }],
      };

      const quoteMessage = composeMessage(existingMessageTimestamp + 1, {
        body: 'quote',
        quote: quotedMessage,
      });

      await asymmetricRoundtripHarness(
        [existingMessage, quoteMessage],
        [
          {
            ...existingMessage,
            attachments: [expectedRoundtrippedFields(existingAttachment)],
          },
          {
            ...quoteMessage,
            quote: {
              ...quotedMessage,
              referencedMessageNotFound: false,
              attachments: [
                {
                  // The thumbnail will not have been copied over yet since it has not yet
                  // been downloaded
                  thumbnail: expectedRoundtrippedFields(quoteAttachment),
                  contentType: VIDEO_MP4,
                },
              ],
            },
          },
        ],
        { backupLevel: BackupLevel.Paid }
      );
    });

    it('handles quotes which have been copied over from the original (and lack all encryption info)', async () => {
      const originalMessage = composeMessage(1, {
        body: 'original',
      });
      const quotedMessage: QuotedMessageType = {
        authorAci: originalMessage.sourceServiceId as AciString,
        isViewOnce: false,
        id: originalMessage.timestamp,
        referencedMessageNotFound: false,
        isGiftBadge: false,
        attachments: [
          {
            thumbnail: {
              contentType: IMAGE_PNG,
              size: 100,
              path: 'path/to/thumbnail',
              localKey: Bytes.toBase64(generateAttachmentKeys()),
              plaintextHash: Bytes.toHex(getRandomBytes(32)),
            },
            contentType: VIDEO_MP4,
          },
        ],
      };

      const quoteMessage = composeMessage(originalMessage.timestamp + 1, {
        body: 'quote',
        quote: quotedMessage,
      });

      await asymmetricRoundtripHarness(
        [originalMessage, quoteMessage],
        [
          originalMessage,
          {
            ...quoteMessage,
            quote: {
              ...quotedMessage,
              referencedMessageNotFound: false,
              attachments: [
                {
                  // will do custom comparison for thumbnail below
                  contentType: VIDEO_MP4,
                },
              ],
            },
          },
        ],
        {
          backupLevel: BackupLevel.Paid,
          comparator: (msgBefore, msgAfter) => {
            if (msgBefore.timestamp === originalMessage.timestamp) {
              return assert.deepStrictEqual(msgBefore, msgAfter);
            }

            const thumbnail = msgAfter.quote?.attachments[0]?.thumbnail;
            strictAssert(thumbnail, 'quote thumbnail exists');

            assert.deepStrictEqual(
              omit(msgBefore, 'quote.attachments[0].thumbnail'),
              omit(msgAfter, 'quote.attachments[0].thumbnail')
            );
            const { key, plaintextHash } = thumbnail;
            strictAssert(thumbnail, 'thumbnail exists');
            strictAssert(key, 'thumbnail key was created');
            strictAssert(plaintextHash, 'quote plaintextHash was roundtripped');
            strictAssert(
              hasRequiredInformationForBackup(thumbnail),
              'has key and plaintextHash'
            );
            assert.deepStrictEqual(thumbnail, {
              contentType: IMAGE_PNG,
              size: 100,
              key: thumbnail.key,
              plaintextHash: thumbnail.plaintextHash,
            });
          },
        }
      );
    });
  });

  describe('sticker attachments', () => {
    const packId = Bytes.toHex(getRandomBytes(16));
    const packKey = Bytes.toBase64(getRandomBytes(32));

    describe('when copied over from sticker pack (i.e. missing encryption info)', () => {
      // TODO: DESKTOP-8896
      it.skip('BackupLevel.Paid, generates new encryption info', async () => {
        await asymmetricRoundtripHarness(
          [
            composeMessage(1, {
              sticker: {
                emoji: '🐒',
                packId,
                packKey,
                stickerId: 0,
                data: {
                  contentType: IMAGE_WEBP,
                  path: 'path/to/sticker',
                  size: 5322,
                  width: 512,
                  height: 512,
                },
              },
            }),
          ],
          [
            composeMessage(1, {
              sticker: {
                emoji: '🐒',
                packId,
                packKey,
                stickerId: 0,
                data: {
                  contentType: IMAGE_WEBP,
                  size: 5322,
                  width: 512,
                  height: 512,
                },
              },
            }),
          ],
          {
            backupLevel: BackupLevel.Paid,
            comparator: (msgBefore, msgAfter) => {
              assert.deepStrictEqual(
                omit(msgBefore, 'sticker.data'),
                omit(msgAfter, 'sticker.data')
              );
              strictAssert(msgAfter.sticker?.data, 'sticker data exists');

              const { key, digest } = msgAfter.sticker.data;
              strictAssert(digest, 'sticker digest was created');

              assert.equal(Bytes.fromBase64(digest ?? '').byteLength, 32);
              assert.equal(Bytes.fromBase64(key ?? '').byteLength, 64);

              assert.deepStrictEqual(msgAfter.sticker.data, {
                contentType: IMAGE_WEBP,
                size: 5322,
                width: 512,
                height: 512,
                key,
                digest,
              });
            },
          }
        );
      });
      it('BackupLevel.Free, generates invalid attachment locator', async () => {
        // since we aren't re-uploading with new encryption info, we can't include this
        // attachment in the backup proto
        await asymmetricRoundtripHarness(
          [
            composeMessage(1, {
              sticker: {
                emoji: '🐒',
                packId,
                packKey,
                stickerId: 0,
                data: {
                  contentType: IMAGE_WEBP,
                  path: 'path/to/sticker',
                  size: 5322,
                  width: 512,
                  height: 512,
                },
              },
            }),
          ],
          [
            composeMessage(1, {
              sticker: {
                emoji: '🐒',
                packId,
                packKey,
                stickerId: 0,
                data: {
                  contentType: IMAGE_WEBP,
                  size: 0,
                  error: true,
                  height: 512,
                  width: 512,
                },
              },
            }),
          ],
          {
            backupLevel: BackupLevel.Free,
          }
        );
      });
    });
    describe('when this device sent sticker (i.e. encryption info exists on message)', () => {
      it('roundtrips sticker', async () => {
        const attachment = composeAttachment(1, { clientUuid: undefined });
        strictAssert(attachment.digest, 'digest exists');
        await asymmetricRoundtripHarness(
          [
            composeMessage(1, {
              sticker: {
                emoji: '🐒',
                packId,
                packKey,
                stickerId: 0,
                data: attachment,
              },
            }),
          ],
          [
            composeMessage(1, {
              sticker: {
                emoji: '🐒',
                packId,
                packKey,
                stickerId: 0,
                data: expectedRoundtrippedFields(attachment),
              },
            }),
          ],
          {
            backupLevel: BackupLevel.Paid,
          }
        );
      });
    });
  });
});
