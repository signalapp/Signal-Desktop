// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { v4 as generateGuid } from 'uuid';
import { BackupLevel } from '@signalapp/libsignal-client/zkgroup';
import { omit } from 'lodash';

import type { ConversationModel } from '../../models/conversations';
import * as Bytes from '../../Bytes';
import Data from '../../sql/Client';
import { type AciString, generateAci } from '../../types/ServiceId';
import { ReadStatus } from '../../messages/MessageReadStatus';
import { SeenStatus } from '../../MessageSeenStatus';
import { loadCallsHistory } from '../../services/callHistoryLoader';
import { setupBasics, asymmetricRoundtripHarness } from './helpers';
import { AUDIO_MP3, IMAGE_JPEG, IMAGE_PNG, VIDEO_MP4 } from '../../types/MIME';
import type {
  MessageAttributesType,
  QuotedMessageType,
} from '../../model-types';
import { isVoiceMessage, type AttachmentType } from '../../types/Attachment';
import { strictAssert } from '../../util/assert';
import { SignalService } from '../../protobuf';

const CONTACT_A = generateAci();

describe('backup/attachments', () => {
  let contactA: ConversationModel;

  beforeEach(async () => {
    await Data._removeAllMessages();
    await Data._removeAllConversations();
    window.storage.reset();

    await setupBasics();

    contactA = await window.ConversationController.getOrCreateAndWait(
      CONTACT_A,
      'private',
      { systemGivenName: 'CONTACT_A' }
    );

    await loadCallsHistory();
  });

  function getBase64(str: string): string {
    return Bytes.toBase64(Bytes.fromString(str));
  }

  function composeAttachment(
    index: number,
    overrides?: Partial<AttachmentType>
  ): AttachmentType {
    return {
      cdnKey: `cdnKey${index}`,
      cdnNumber: 3,
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
        path: '/path/to/thumbnail.png',
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
        BackupLevel.Messages
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
                backupLocator: { mediaName: attachment.digest },
              },
            ],
          }),
        ],
        BackupLevel.Media
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
                backupLocator: { mediaName: attachment.digest },
              },
            ],
          }),
        ],
        BackupLevel.Media
      );
    });
  });

  describe('Preview attachments', () => {
    it('BackupLevel.Messages, roundtrips preview attachments', async () => {
      const attachment = composeAttachment(1);

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
        BackupLevel.Messages
      );
    });
    it('BackupLevel.Media, roundtrips preview attachments', async () => {
      const attachment = composeAttachment(1);
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
                  backupLocator: { mediaName: attachment.digest },
                },
              },
            ],
          }),
        ],
        BackupLevel.Media
      );
    });
  });

  describe('contact attachments', () => {
    it('BackupLevel.Messages, roundtrips contact attachments', async () => {
      const attachment = composeAttachment(1);

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
        BackupLevel.Messages
      );
    });
    it('BackupLevel.Media, roundtrips contact attachments', async () => {
      const attachment = composeAttachment(1);
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
                    backupLocator: { mediaName: attachment.digest },
                  },
                  isProfile: false,
                },
              },
            ],
          }),
        ],
        BackupLevel.Media
      );
    });
  });

  describe('quotes', () => {
    it('BackupLevel.Messages, roundtrips quote attachments', async () => {
      const attachment = composeAttachment(1);
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
        BackupLevel.Messages
      );
    });
    it('BackupLevel.Media, roundtrips quote attachments', async () => {
      const attachment = composeAttachment(1);
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
                    backupLocator: { mediaName: attachment.digest },
                  },
                  contentType: VIDEO_MP4,
                },
              ],
            },
          }),
        ],
        BackupLevel.Media
      );
    });

    it('Copies data from message if it exists', async () => {
      const existingAttachment = composeAttachment(1);
      const existingMessageTimestamp = Date.now();
      const existingMessage = composeMessage(existingMessageTimestamp, {
        attachments: [existingAttachment],
      });

      const quoteAttachment = composeAttachment(2);
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
                backupLocator: { mediaName: existingAttachment.digest },
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
                    backupLocator: { mediaName: quoteAttachment.digest },
                  },
                  contentType: VIDEO_MP4,
                },
              ],
            },
          },
        ],
        BackupLevel.Media
      );
    });
  });
});
