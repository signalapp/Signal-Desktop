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
import { loadCallsHistory } from '../../services/callHistoryLoader';
import { setupBasics, asymmetricRoundtripHarness } from './helpers';
import {
  AUDIO_MP3,
  IMAGE_JPEG,
  IMAGE_PNG,
  IMAGE_WEBP,
  VIDEO_MP4,
} from '../../types/MIME';
import type {
  MessageAttributesType,
  QuotedMessageType,
} from '../../model-types';
import { isVoiceMessage, type AttachmentType } from '../../types/Attachment';
import { strictAssert } from '../../util/assert';
import { SignalService } from '../../protobuf';
import { getRandomBytes } from '../../Crypto';

const CONTACT_A = generateAci();

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
      { systemGivenName: 'CONTACT_A' }
    );

    await loadCallsHistory();

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

  function getBase64(str: string): string {
    return Bytes.toBase64(Bytes.fromString(str));
  }

  function digestToMediaName(digestBase64: string): string {
    return Bytes.toHex(Bytes.fromBase64(digestBase64));
  }

  function composeAttachment(
    index: number,
    overrides?: Partial<AttachmentType>
  ): AttachmentType {
    return {
      cdnKey: `cdnKey${index}`,
      cdnNumber: 3,
      clientUuid: generateGuid(),
      key: getBase64(`key${index}`),
      digest: getBase64(`digest${index}`),
      iv: getBase64(`iv${index}`),
      size: 100,
      contentType: IMAGE_JPEG,
      path: `/path/to/file${index}.png`,
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
      sent_at: timestamp,
      timestamp,
      readStatus: ReadStatus.Read,
      seenStatus: SeenStatus.Seen,
      unidentifiedDeliveryReceived: true,
      ...overrides,
    };
  }

  describe('normal attachments', () => {
    it('BackupLevel.Messages, roundtrips normal attachments', async () => {
      const attachment1 = composeAttachment(1);
      const attachment2 = composeAttachment(2);

      await asymmetricRoundtripHarness(
        [
          composeMessage(1, {
            attachments: [attachment1, attachment2],
          }),
        ],
        // path & iv will not be roundtripped
        [
          composeMessage(1, {
            attachments: [
              omit(attachment1, ['path', 'iv', 'thumbnail']),
              omit(attachment2, ['path', 'iv', 'thumbnail']),
            ],
          }),
        ],
        { backupLevel: BackupLevel.Messages }
      );
    });
    it('BackupLevel.Media, roundtrips normal attachments', async () => {
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
            // path, iv, and uploadTimestamp will not be roundtripped,
            // but there will be a backupLocator
            attachments: [
              {
                ...omit(attachment, [
                  'path',
                  'iv',
                  'thumbnail',
                  'uploadTimestamp',
                ]),
                backupLocator: {
                  mediaName: digestToMediaName(attachment.digest),
                },
              },
            ],
          }),
        ],
        { backupLevel: BackupLevel.Media }
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
            attachments: [
              {
                ...omit(attachment, [
                  'path',
                  'iv',
                  'thumbnail',
                  'uploadTimestamp',
                ]),
                backupLocator: {
                  mediaName: digestToMediaName(attachment.digest),
                },
              },
            ],
          }),
        ],
        { backupLevel: BackupLevel.Media }
      );
    });
  });

  describe('Preview attachments', () => {
    it('BackupLevel.Messages, roundtrips preview attachments', async () => {
      const attachment = composeAttachment(1, { clientUuid: undefined });

      await asymmetricRoundtripHarness(
        [
          composeMessage(1, {
            preview: [{ url: 'url', date: 1, image: attachment }],
          }),
        ],
        // path & iv will not be roundtripped
        [
          composeMessage(1, {
            preview: [
              {
                url: 'url',
                date: 1,
                image: omit(attachment, ['path', 'iv', 'thumbnail']),
              },
            ],
          }),
        ],
        { backupLevel: BackupLevel.Messages }
      );
    });
    it('BackupLevel.Media, roundtrips preview attachments', async () => {
      const attachment = composeAttachment(1, { clientUuid: undefined });
      strictAssert(attachment.digest, 'digest exists');

      await asymmetricRoundtripHarness(
        [
          composeMessage(1, {
            preview: [
              {
                url: 'url',
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
            preview: [
              {
                url: 'url',
                date: 1,
                title: 'title',
                description: 'description',
                image: {
                  // path, iv, and uploadTimestamp will not be roundtripped,
                  // but there will be a backupLocator
                  ...omit(attachment, [
                    'path',
                    'iv',
                    'thumbnail',
                    'uploadTimestamp',
                  ]),
                  backupLocator: {
                    mediaName: digestToMediaName(attachment.digest),
                  },
                },
              },
            ],
          }),
        ],
        { backupLevel: BackupLevel.Media }
      );
    });
  });

  describe('contact attachments', () => {
    it('BackupLevel.Messages, roundtrips contact attachments', async () => {
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
                  avatar: omit(attachment, ['path', 'iv', 'thumbnail']),
                  isProfile: false,
                },
              },
            ],
          }),
        ],
        { backupLevel: BackupLevel.Messages }
      );
    });
    it('BackupLevel.Media, roundtrips contact attachments', async () => {
      const attachment = composeAttachment(1, { clientUuid: undefined });
      strictAssert(attachment.digest, 'digest exists');

      await asymmetricRoundtripHarness(
        [
          composeMessage(1, {
            contact: [{ avatar: { avatar: attachment, isProfile: false } }],
          }),
        ],
        // path, iv, and uploadTimestamp will not be roundtripped,
        // but there will be a backupLocator
        [
          composeMessage(1, {
            contact: [
              {
                avatar: {
                  avatar: {
                    ...omit(attachment, [
                      'path',
                      'iv',
                      'thumbnail',
                      'uploadTimestamp',
                    ]),
                    backupLocator: {
                      mediaName: digestToMediaName(attachment.digest),
                    },
                  },
                  isProfile: false,
                },
              },
            ],
          }),
        ],
        { backupLevel: BackupLevel.Media }
      );
    });
  });

  describe('quotes', () => {
    it('BackupLevel.Messages, roundtrips quote attachments', async () => {
      const attachment = composeAttachment(1, { clientUuid: undefined });
      const authorAci = generateAci();
      const quotedMessage: QuotedMessageType = {
        authorAci,
        isViewOnce: false,
        id: Date.now(),
        referencedMessageNotFound: false,
        messageId: '',
        isGiftBadge: true,
        attachments: [{ thumbnail: attachment, contentType: VIDEO_MP4 }],
      };

      await asymmetricRoundtripHarness(
        [
          composeMessage(1, {
            quote: quotedMessage,
          }),
        ],
        // path & iv will not be roundtripped
        [
          composeMessage(1, {
            quote: {
              ...quotedMessage,
              referencedMessageNotFound: true,
              attachments: [
                {
                  thumbnail: omit(attachment, ['iv', 'path', 'thumbnail']),
                  contentType: VIDEO_MP4,
                },
              ],
            },
          }),
        ],
        { backupLevel: BackupLevel.Messages }
      );
    });
    it('BackupLevel.Media, roundtrips quote attachments', async () => {
      const attachment = composeAttachment(1, { clientUuid: undefined });
      strictAssert(attachment.digest, 'digest exists');
      const authorAci = generateAci();
      const quotedMessage: QuotedMessageType = {
        authorAci,
        isViewOnce: false,
        id: Date.now(),
        referencedMessageNotFound: false,
        messageId: '',
        isGiftBadge: true,
        attachments: [{ thumbnail: attachment, contentType: VIDEO_MP4 }],
      };

      await asymmetricRoundtripHarness(
        [
          composeMessage(1, {
            quote: quotedMessage,
          }),
        ],
        [
          composeMessage(1, {
            quote: {
              ...quotedMessage,
              referencedMessageNotFound: true,
              attachments: [
                {
                  thumbnail: {
                    ...omit(attachment, [
                      'iv',
                      'path',
                      'uploadTimestamp',
                      'thumbnail',
                    ]),
                    backupLocator: {
                      mediaName: digestToMediaName(attachment.digest),
                    },
                  },
                  contentType: VIDEO_MP4,
                },
              ],
            },
          }),
        ],
        { backupLevel: BackupLevel.Media }
      );
    });

    it('Copies data from message if it exists', async () => {
      const existingAttachment = composeAttachment(1);
      const existingMessageTimestamp = Date.now();
      const existingMessage = composeMessage(existingMessageTimestamp, {
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
        messageId: '',
        isGiftBadge: false,
        attachments: [{ thumbnail: quoteAttachment, contentType: VIDEO_MP4 }],
      };

      const quoteMessage = composeMessage(existingMessageTimestamp + 1, {
        quote: quotedMessage,
      });

      await asymmetricRoundtripHarness(
        [existingMessage, quoteMessage],
        [
          {
            ...existingMessage,
            attachments: [
              {
                ...omit(existingAttachment, [
                  'path',
                  'iv',
                  'uploadTimestamp',
                  'thumbnail',
                ]),
                backupLocator: {
                  mediaName: digestToMediaName(existingAttachment.digest),
                },
              },
            ],
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
                  thumbnail: {
                    ...omit(quoteAttachment, ['iv', 'path', 'uploadTimestamp']),
                    backupLocator: {
                      mediaName: digestToMediaName(quoteAttachment.digest),
                    },
                  },
                  contentType: VIDEO_MP4,
                },
              ],
            },
          },
        ],
        { backupLevel: BackupLevel.Media }
      );
    });

    it('handles quotes which have been copied over from the original (and lack all encryption info)', async () => {
      const originalMessage = composeMessage(1);
      const quotedMessage: QuotedMessageType = {
        authorAci: originalMessage.sourceServiceId as AciString,
        isViewOnce: false,
        id: originalMessage.timestamp,
        referencedMessageNotFound: false,
        messageId: '',
        isGiftBadge: false,
        attachments: [
          {
            thumbnail: {
              contentType: IMAGE_PNG,
              size: 100,
              path: 'path/to/thumbnail',
            },
            contentType: VIDEO_MP4,
          },
        ],
      };

      const quoteMessage = composeMessage(originalMessage.timestamp + 1, {
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
          backupLevel: BackupLevel.Media,
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

            const { key, digest } = thumbnail;
            strictAssert(digest, 'quote digest was created');
            strictAssert(key, 'quote digest was created');

            assert.deepStrictEqual(thumbnail, {
              contentType: IMAGE_PNG,
              size: 100,
              key,
              digest,
              backupLocator: {
                mediaName: digestToMediaName(digest),
              },
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
      it('BackupLevel.Media, generates new encryption info', async () => {
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
            backupLevel: BackupLevel.Media,
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
                backupLocator: {
                  mediaName: digestToMediaName(digest),
                },
              });
            },
          }
        );
      });
      it('BackupLevel.Messages, generates invalid attachment locator', async () => {
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
            backupLevel: BackupLevel.Messages,
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
                data: {
                  ...omit(attachment, [
                    'iv',
                    'path',
                    'thumbnail',
                    'uploadTimestamp',
                  ]),
                  backupLocator: {
                    mediaName: digestToMediaName(attachment.digest),
                  },
                },
              },
            }),
          ],
          {
            backupLevel: BackupLevel.Media,
          }
        );
      });
    });
  });
});
