// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateGuid } from 'uuid';

import * as Bytes from '../Bytes.std.js';
import type {
  EphemeralAttachmentFields,
  ScreenshotType,
  AttachmentType,
  ThumbnailType,
  BackupThumbnailType,
} from '../types/Attachment.std.js';
import {
  APPLICATION_OCTET_STREAM,
  IMAGE_JPEG,
  IMAGE_PNG,
  LONG_MESSAGE,
} from '../types/MIME.std.js';
import type { MessageAttributesType } from '../model-types.d.ts';
import { generateAci } from '../types/ServiceId.std.js';
import { ReadStatus } from '../messages/MessageReadStatus.std.js';
import { SeenStatus } from '../MessageSeenStatus.std.js';
import { DataWriter, DataReader } from '../sql/Client.preload.js';
import { strictAssert } from '../util/assert.std.js';
import { HOUR, MINUTE } from '../util/durations/index.std.js';

const CONTACT_A = generateAci();
const contactAConversationId = generateGuid();
function getBase64(str: string): string {
  return Bytes.toBase64(Bytes.fromString(str));
}

function composeThumbnail(
  index: number,
  overrides?: Partial<AttachmentType>
): ThumbnailType {
  return {
    size: 1024,
    contentType: IMAGE_PNG,
    path: `path/to/thumbnail${index}`,
    localKey: `thumbnailLocalKey${index}`,
    version: 2,
    ...overrides,
  };
}
function composeBackupThumbnail(
  index: number,
  overrides?: Partial<AttachmentType>
): BackupThumbnailType {
  return {
    size: 1024,
    contentType: IMAGE_JPEG,
    path: `path/to/backupThumbnail${index}`,
    localKey: 'backupThumbnailLocalKey',
    version: 2,
    ...overrides,
  };
}

function composeScreenshot(
  index: number,
  overrides?: Partial<AttachmentType>
): ScreenshotType {
  return {
    size: 1024,
    contentType: IMAGE_PNG,
    path: `path/to/screenshot${index}`,
    localKey: `screenshotLocalKey${index}`,
    version: 2,
    ...overrides,
  };
}

let index = 0;
function composeAttachment(
  key?: string,
  overrides?: Partial<AttachmentType>
  // NB: Required<AttachmentType> to ensure we are roundtripping every property in
  // AttachmentType! If you are here you probably just added a field to AttachmentType;
  // Make sure you add a column to the `message_attachments` table and update
  // MESSAGE_ATTACHMENT_COLUMNS.
): Required<Omit<AttachmentType, keyof EphemeralAttachmentFields>> {
  const label = `${key ?? 'attachment'}${index}`;
  const attachment = {
    cdnKey: `cdnKey${label}`,
    cdnNumber: 3,
    key: getBase64(`key${label}`),
    digest: getBase64(`digest${label}`),
    duration: 123,
    size: 100,
    downloadPath: 'downloadPath',
    contentType: IMAGE_JPEG,
    path: `path/to/file${label}`,
    pending: false,
    localKey: 'localKey',
    plaintextHash: `plaintextHash${label}`,
    uploadTimestamp: index,
    clientUuid: generateGuid(),
    width: 100,
    height: 120,
    blurHash: 'blurHash',
    caption: 'caption',
    fileName: 'filename',
    flags: 8,
    incrementalMac: 'incrementalMac',
    chunkSize: 128,
    version: 2,
    backupCdnNumber: index,
    localBackupPath: `localBackupPath/${label}`,
    // This would only exist on a story message with contentType TEXT_ATTACHMENT,
    // but inluding it here to ensure we are roundtripping all fields
    textAttachment: {
      text: 'text',
      textStyle: 3,
    },
    // defaulting all of these booleans to true to ensure that we are actually
    // roundtripping them to/from the DB
    wasTooBig: true,
    error: true,
    isCorrupted: true,
    backfillError: true,
    copied: true,
    thumbnail: composeThumbnail(index),
    screenshot: composeScreenshot(index),
    thumbnailFromBackup: composeBackupThumbnail(index),
    ...overrides,
  } as const;

  index += 1;
  return attachment;
}

function composeMessage(
  timestamp: number,
  overrides?: Partial<MessageAttributesType>
): MessageAttributesType {
  return {
    schemaVersion: 12,
    conversationId: contactAConversationId,
    id: generateGuid(),
    type: 'incoming',
    body: undefined,
    received_at: timestamp,
    received_at_ms: timestamp,
    sourceServiceId: CONTACT_A,
    sourceDevice: 1,
    sent_at: timestamp,
    timestamp,
    readStatus: ReadStatus.Read,
    seenStatus: SeenStatus.Seen,
    isErased: false,
    mentionsMe: false,
    isViewOnce: false,
    unidentifiedDeliveryReceived: false,
    serverGuid: undefined,
    serverTimestamp: undefined,
    source: undefined,
    storyId: undefined,
    expirationStartTimestamp: undefined,
    expireTimer: undefined,
    ...overrides,
  };
}

describe('normalizes attachment references', () => {
  beforeEach(async () => {
    await DataWriter.removeAll();
  });

  it('saves message with undownloaded attachments', async () => {
    const attachment1: AttachmentType = {
      ...composeAttachment(),
      path: undefined,
      localKey: undefined,
      plaintextHash: undefined,
      version: undefined,
    };
    const attachment2: AttachmentType = {
      ...composeAttachment(),
      path: undefined,
      localKey: undefined,
      plaintextHash: undefined,
      version: undefined,
    };

    delete attachment1.thumbnail;
    delete attachment1.screenshot;
    delete attachment1.thumbnailFromBackup;

    delete attachment2.thumbnail;
    delete attachment2.screenshot;
    delete attachment2.thumbnailFromBackup;

    const attachments = [attachment1, attachment2];
    const message = composeMessage(Date.now(), {
      attachments,
    });

    await DataWriter.saveMessage(message, {
      forceSave: true,
      ourAci: generateAci(),
      postSaveUpdates: () => Promise.resolve(),
    });

    const references = await DataReader.getAttachmentReferencesForMessages([
      message.id,
    ]);

    assert.equal(references.length, attachments.length);

    const messageFromDB = await DataReader.getMessageById(message.id);
    assert(messageFromDB, 'message was saved');
    assert.deepEqual(messageFromDB, message);
  });

  it('saves message with downloaded attachments, and hydrates on get', async () => {
    const attachments = [
      composeAttachment('first'),
      composeAttachment('second'),
    ];
    const message = composeMessage(Date.now(), {
      attachments,
    });

    await DataWriter.saveMessage(message, {
      forceSave: true,
      ourAci: generateAci(),
      postSaveUpdates: () => Promise.resolve(),
    });

    const messageFromDB = await DataReader.getMessageById(message.id);
    assert(messageFromDB, 'message was saved');
    assert.deepEqual(messageFromDB, message);
  });

  it('saves and re-hydrates messages with normal, body, preview, quote, contact, and sticker attachments', async () => {
    const attachment1 = composeAttachment('first');
    const attachment2 = composeAttachment('second');
    const previewAttachment1 = composeAttachment('preview1');
    const previewAttachment2 = composeAttachment('preview2');
    const quoteAttachment1 = composeAttachment('quote1');
    const quoteAttachment2 = composeAttachment('quote2');
    const contactAttachment1 = composeAttachment('contact1');
    const contactAttachment2 = composeAttachment('contact2');
    const stickerAttachment = composeAttachment('sticker');
    const bodyAttachment = composeAttachment('body', {
      contentType: LONG_MESSAGE,
    });

    const message = composeMessage(Date.now(), {
      attachments: [attachment1, attachment2],
      bodyAttachment,
      preview: [
        {
          title: 'preview',
          description: 'description',
          domain: 'domain',
          url: 'https://signal.org',
          isStickerPack: false,
          isCallLink: false,
          image: previewAttachment1,
          date: Date.now(),
        },
        {
          title: 'preview2',
          description: 'description2',
          domain: 'domain2',
          url: 'https://signal2.org',
          isStickerPack: true,
          isCallLink: false,
          image: previewAttachment2,
          date: Date.now(),
        },
      ],
      quote: {
        id: Date.now(),
        referencedMessageNotFound: true,
        isViewOnce: false,
        messageId: 'quotedMessageId',
        attachments: [
          {
            contentType: IMAGE_JPEG,
            thumbnail: quoteAttachment1,
          },
          {
            contentType: IMAGE_PNG,
            thumbnail: quoteAttachment2,
          },
        ],
      },
      contact: [
        {
          name: {
            givenName: 'Alice',
            familyName: 'User',
          },
          avatar: {
            isProfile: true,
            avatar: contactAttachment1,
          },
        },
        {
          name: {
            givenName: 'Bob',
            familyName: 'User',
          },
          avatar: {
            isProfile: false,
            avatar: contactAttachment2,
          },
        },
      ],
      sticker: {
        packId: 'stickerPackId',
        stickerId: 123,
        packKey: 'abcdefg',
        data: stickerAttachment,
      },
    });

    await DataWriter.saveMessage(message, {
      forceSave: true,
      ourAci: generateAci(),
      postSaveUpdates: () => Promise.resolve(),
    });

    const messageFromDB = await DataReader.getMessageById(message.id);
    assert(messageFromDB, 'message was saved');
    assert.deepEqual(messageFromDB, message);
  });

  it('handles quote attachments with copied thumbnail', async () => {
    const referencedAttachment = composeAttachment('quotedattachment', {
      thumbnail: composeThumbnail(0),
    });
    strictAssert(referencedAttachment.plaintextHash, 'exists');
    const referencedMessage = composeMessage(1, {
      attachments: [referencedAttachment],
    });
    const quoteMessage = composeMessage(2, {
      quote: {
        id: Date.now(),
        referencedMessageNotFound: false,
        isViewOnce: false,
        messageId: 'quotedMessageId',
        attachments: [
          {
            fileName: 'filename',
            contentType: IMAGE_PNG,
            thumbnail: { ...composeAttachment(), copied: true },
          },
        ],
      },
    });

    await DataWriter.saveMessage(referencedMessage, {
      forceSave: true,
      ourAci: generateAci(),
      postSaveUpdates: () => Promise.resolve(),
    });
    await DataWriter.saveMessage(quoteMessage, {
      forceSave: true,
      ourAci: generateAci(),
      postSaveUpdates: () => Promise.resolve(),
    });

    const messageFromDB = await DataReader.getMessageById(quoteMessage.id);
    assert(messageFromDB, 'message was saved');
    assert.deepEqual(messageFromDB, quoteMessage);
  });

  it('deletes and re-orders attachments as necessary', async () => {
    await DataWriter.removeAll();
    const attachment1 = composeAttachment();
    const attachment2 = composeAttachment();
    const attachment3 = composeAttachment();

    const attachments = [attachment1, attachment2, attachment3];
    const message = composeMessage(Date.now(), {
      attachments,
    });

    await DataWriter.saveMessage(message, {
      forceSave: true,
      ourAci: generateAci(),
      postSaveUpdates: () => Promise.resolve(),
    });

    const messageFromDB = await DataReader.getMessageById(message.id);
    assert(messageFromDB, 'message was saved');
    assert.deepEqual(messageFromDB, message);

    /** Re-order the attachments */
    const messageWithReorderedAttachments = {
      ...message,
      attachments: [attachment3, attachment2, attachment1],
    };
    await DataWriter.saveMessage(messageWithReorderedAttachments, {
      ourAci: generateAci(),
      postSaveUpdates: () => Promise.resolve(),
    });
    const messageWithReorderedAttachmentsFromDB =
      await DataReader.getMessageById(message.id);

    assert(messageWithReorderedAttachmentsFromDB, 'message was saved');
    assert.deepEqual(
      messageWithReorderedAttachmentsFromDB,
      messageWithReorderedAttachments
    );

    /** Drop the last attachment */
    const messageWithDeletedAttachment = {
      ...message,
      attachments: [attachment1, attachment2],
    };
    await DataWriter.saveMessage(messageWithDeletedAttachment, {
      ourAci: generateAci(),
      postSaveUpdates: () => Promise.resolve(),
    });
    const messageWithDeletedAttachmentFromDB = await DataReader.getMessageById(
      message.id
    );

    assert(messageWithDeletedAttachmentFromDB, 'message was saved');
    assert.deepEqual(
      messageWithDeletedAttachmentFromDB,
      messageWithDeletedAttachment
    );
  });

  it('deletes attachment references when message is deleted', async () => {
    const attachment1 = composeAttachment();
    const attachment2 = composeAttachment();

    const attachments = [attachment1, attachment2];
    const message = composeMessage(Date.now(), {
      attachments,
    });

    const message2 = composeMessage(Date.now(), {
      attachments: [composeAttachment()],
    });

    await DataWriter.saveMessages([message, message2], {
      forceSave: true,
      ourAci: generateAci(),
      postSaveUpdates: () => Promise.resolve(),
    });

    assert.equal(
      (await DataReader.getAttachmentReferencesForMessages([message.id]))
        .length,
      2
    );
    assert.equal(
      (await DataReader.getAttachmentReferencesForMessages([message2.id]))
        .length,
      1
    );

    // Deleting message should delete all references
    await DataWriter._removeMessage(message.id);

    assert.deepEqual(
      await DataReader.getAttachmentReferencesForMessages([message.id]),
      []
    );
    assert.equal(
      (await DataReader.getAttachmentReferencesForMessages([message2.id]))
        .length,
      1
    );
  });
  it('roundtrips edithistory attachments with normal, body, preview, and quote attachments', async () => {
    const mainMessageFields = {
      attachments: [composeAttachment('main1'), composeAttachment('main2')],
      bodyAttachment: composeAttachment('body1', {
        contentType: LONG_MESSAGE,
      }),
      preview: [
        {
          title: 'preview',
          description: 'description',
          domain: 'domain',
          url: 'https://signal.org',
          isStickerPack: false,
          isCallLink: false,
          image: composeAttachment('preview1'),
          date: Date.now(),
        },
      ],
      quote: {
        id: Date.now(),
        referencedMessageNotFound: true,
        isViewOnce: false,
        messageId: 'quotedMessageId',
        attachments: [
          {
            contentType: IMAGE_JPEG,
            thumbnail: composeAttachment('quote3'),
          },
        ],
      },
    };

    const now = Date.now();

    const message = composeMessage(now, {
      ...mainMessageFields,
      editMessageReceivedAt: now + HOUR + 42,
      editMessageTimestamp: now + HOUR,
      editHistory: [
        {
          timestamp: now + HOUR,
          received_at: now + HOUR + 42,
          attachments: [
            composeAttachment('main.edit1.1'),
            composeAttachment('main.edit1.2'),
          ],
          bodyAttachment: composeAttachment('body.edit1', {
            contentType: LONG_MESSAGE,
          }),
          preview: [
            {
              title: 'preview',
              description: 'description',
              domain: 'domain',
              url: 'https://signal.org',
              isStickerPack: false,
              isCallLink: true,
              image: composeAttachment('preview.edit1'),
              date: Date.now(),
            },
          ],
          quote: {
            id: Date.now(),
            referencedMessageNotFound: true,
            isViewOnce: false,
            messageId: 'quotedMessageId',
            attachments: [
              {
                contentType: IMAGE_JPEG,
                thumbnail: composeAttachment('quote.edit1'),
              },
            ],
          },
        },
        {
          timestamp: now + MINUTE,
          received_at: now + MINUTE + 42,
          attachments: [
            composeAttachment('main.edit2.1'),
            composeAttachment('main.edit2.2'),
          ],
          bodyAttachment: composeAttachment('body.edit2', {
            contentType: LONG_MESSAGE,
          }),
          preview: [
            {
              title: 'preview',
              description: 'description',
              domain: 'domain',
              url: 'https://signal.org',
              isStickerPack: false,
              isCallLink: true,
              image: composeAttachment('preview.edit2'),
              date: Date.now(),
            },
          ],
          quote: {
            id: Date.now(),
            referencedMessageNotFound: true,
            isViewOnce: false,
            messageId: 'quotedMessageId',
            attachments: [
              {
                contentType: IMAGE_JPEG,
                thumbnail: composeAttachment('quote.edit2'),
              },
            ],
          },
        },
        {
          timestamp: now,
          received_at: now,
          ...mainMessageFields,
        },
      ],
    });

    await DataWriter.saveMessage(message, {
      forceSave: true,
      ourAci: generateAci(),
      postSaveUpdates: () => Promise.resolve(),
    });

    const messageAttachments =
      await DataReader.getAttachmentReferencesForMessages([message.id]);
    // 5 attachments, plus 3 versions in editHistory = 20 attachments total
    assert.deepEqual(messageAttachments.length, 20);

    const messageFromDB = await DataReader.getMessageById(message.id);
    assert(messageFromDB, 'message was saved');
    assert.deepEqual(messageFromDB, message);
  });

  describe('handles bad data', () => {
    const badDataAttachment = {
      ...composeAttachment(),
      size: undefined,
      contentType: undefined,
      width: '100',
      isCorrupted: 1,
      key: {},
      digest: { '1': 234 },
      randomKey: 'random',
      uploadTimestamp: {
        low: 6174,
        high: 0,
        unsigned: false,
      },
      incrementalMac: Bytes.fromString('incrementalMac'),
    } as unknown as AttachmentType & { randomKey?: string };

    const cleanedAttachment = {
      ...badDataAttachment,
      size: 0,
      width: undefined,
      digest: undefined,
      key: undefined,
      isCorrupted: undefined,
      contentType: APPLICATION_OCTET_STREAM,
      uploadTimestamp: undefined,
      incrementalMac: undefined,
    };
    delete cleanedAttachment.randomKey;

    it('is resilient to bad data when saved', async () => {
      const message = composeMessage(Date.now(), {
        attachments: [badDataAttachment],
      });

      await DataWriter.saveMessage(message, {
        forceSave: true,
        ourAci: generateAci(),
        postSaveUpdates: () => Promise.resolve(),
      });

      const messageFromDB = await DataReader.getMessageById(message.id);
      assert(messageFromDB, 'message was saved');
      assert.deepEqual(messageFromDB.attachments?.[0], cleanedAttachment);
    });

    it('is resilient to bad data when saved via saveMessagesIndividually', async () => {
      const attachments = [badDataAttachment];
      const message = composeMessage(Date.now(), {
        attachments,
      });

      await DataWriter.saveMessages([message], {
        forceSave: true,
        ourAci: generateAci(),
        postSaveUpdates: () => Promise.resolve(),
        _testOnlyAvoidNormalizingAttachments: true,
      });

      await DataWriter.saveMessagesIndividually([message], {
        ourAci: generateAci(),
        postSaveUpdates: () => Promise.resolve(),
      });

      const messageFromDB = await DataReader.getMessageById(message.id);
      assert(messageFromDB, 'message was saved');
      assert.deepEqual(messageFromDB.attachments?.[0], cleanedAttachment);
    });
  });
  it('adds a placeholder attachment when attachments had been deleted', async () => {
    const message = composeMessage(Date.now(), {
      attachments: [composeAttachment(), composeAttachment()],
    });

    await DataWriter.saveMessage(message, {
      forceSave: true,
      ourAci: generateAci(),
      postSaveUpdates: () => Promise.resolve(),
    });

    await DataWriter._testOnlyRemoveMessageAttachments(message.timestamp);

    const messageFromDB = await DataReader.getMessageById(message.id);
    assert(messageFromDB, 'message was saved');
    assert.deepEqual(messageFromDB.attachments?.[0], {
      size: 0,
      contentType: IMAGE_PNG,
      width: 150,
      height: 150,
      error: true,
    });
  });
});
