// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import fsExtra from 'fs-extra';
import { v4 as generateUuid } from 'uuid';
import { readdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { missingCaseError } from '../util/missingCaseError.std.js';
import {
  getDownloadsPath,
  getAttachmentsPath,
} from '../windows/main/attachments.preload.js';

import { IMAGE_JPEG, LONG_MESSAGE } from '../types/MIME.std.js';
import type { MessageAttributesType } from '../model-types.d.ts';
import type { AttachmentType } from '../types/Attachment.std.js';
import {
  getAbsoluteAttachmentPath,
  getAbsoluteDownloadsPath,
  getAbsoluteDraftPath,
  maybeDeleteAttachmentFile,
} from '../util/migrations.preload.js';
import { strictAssert } from '../util/assert.std.js';
import {
  cleanupAllMessageAttachmentFiles,
  cleanupAttachmentFiles,
} from '../types/Message2.preload.js';
import { DataReader, DataWriter } from '../sql/Client.preload.js';
import { generateAci } from '../types/ServiceId.std.js';
import {
  testAttachmentLocalKey,
  testPlaintextHash,
} from '../test-helpers/attachments.node.js';
import { cleanupMessages } from '../util/cleanup.preload.js';

const { emptyDir, ensureFile } = fsExtra;

function getAbsolutePath(
  path: string,
  type: 'attachment' | 'download' | 'draft'
) {
  switch (type) {
    case 'attachment':
      return getAbsoluteAttachmentPath(path);
    case 'download':
      return getAbsoluteDownloadsPath(path);
    case 'draft':
      return getAbsoluteDraftPath(path);
    default:
      throw missingCaseError(type);
  }
}

async function writeFile(
  path: string,
  type: 'attachment' | 'download' | 'draft'
) {
  await ensureFile(getAbsolutePath(path, type));
}

async function writeFiles(
  num: number,
  type: 'attachment' | 'download' | 'draft'
) {
  for (let i = 0; i < num; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await writeFile(`${type}${i}`, type);
  }
}

function listFiles(type: 'attachment' | 'download' | 'draft'): Array<string> {
  return readdirSync(dirname(getAbsolutePath('fakename', type)));
}

let attachmentIndex = 0;
let downloadIndex = 0;

describe('deleteMessageAttachments', () => {
  beforeEach(async () => {
    attachmentIndex = 0;
    downloadIndex = 0;
    await DataWriter.removeAll();
    await window.ConversationController.reset();
    await window.ConversationController.load();
    await emptyDir(
      getAttachmentsPath(window.SignalContext.config.userDataPath)
    );
    await emptyDir(getDownloadsPath(window.SignalContext.config.userDataPath));
  });

  afterEach(async () => {
    await DataWriter.removeAll();
    await window.ConversationController.reset();
    await emptyDir(
      getAttachmentsPath(window.SignalContext.config.userDataPath)
    );
    await emptyDir(getDownloadsPath(window.SignalContext.config.userDataPath));
  });

  function getAttachmentFilePath() {
    const path = `attachment${attachmentIndex}`;
    attachmentIndex += 1;
    return path;
  }
  function getDownloadFilePath() {
    const path = `download${downloadIndex}`;
    downloadIndex += 1;
    return path;
  }

  function composeAttachment(): AttachmentType {
    return {
      contentType: IMAGE_JPEG,
      size: 128,
      version: 2,
      path: getAttachmentFilePath(),
      localKey: testAttachmentLocalKey(),
      downloadPath: getDownloadFilePath(),
      plaintextHash: testPlaintextHash(),
      thumbnail: {
        contentType: IMAGE_JPEG,
        size: 128,
        version: 2,
        path: getAttachmentFilePath(),
        localKey: testAttachmentLocalKey(),
      },
      screenshot: {
        contentType: IMAGE_JPEG,
        size: 128,
        version: 2,
        path: getAttachmentFilePath(),
        localKey: testAttachmentLocalKey(),
      },
      thumbnailFromBackup: {
        contentType: IMAGE_JPEG,
        size: 128,
        version: 2,
        path: getAttachmentFilePath(),
        localKey: testAttachmentLocalKey(),
      },
    };
  }

  function composeBodyAttachment() {
    return {
      contentType: LONG_MESSAGE,
      size: 128,
      path: getAttachmentFilePath(),
      downloadPath: getDownloadFilePath(),
    };
  }

  function composeMessage(): MessageAttributesType {
    return {
      id: generateUuid(),
      type: 'outgoing',
      sent_at: Date.now(),
      timestamp: Date.now(),
      received_at: Date.now(),
      conversationId: generateUuid(),
    };
  }

  // Update these if more paths are added to composeMessageWithAllAttachments
  const NUM_ATTACHMENT_FILES_IN_MESSAGE = 42;
  const NUM_DOWNLOAD_FILES_IN_MESSAGE = 12;
  function composeMessageWithAllAttachments(): MessageAttributesType {
    const message: MessageAttributesType = {
      ...composeMessage(),
      bodyAttachment: composeBodyAttachment(),
      attachments: [composeAttachment(), composeAttachment()],
      contact: [
        {
          avatar: {
            isProfile: false,
            avatar: composeAttachment(),
          },
        },
      ],
      preview: [
        {
          url: 'url',
          image: composeAttachment(),
        },
      ],

      quote: {
        id: Date.now(),
        isViewOnce: false,
        referencedMessageNotFound: false,
        attachments: [
          {
            contentType: IMAGE_JPEG,
            thumbnail: composeAttachment(),
          },
        ],
      },
      sticker: {
        packId: 'packId',
        stickerId: 42,
        packKey: 'packKey',
        data: composeAttachment(),
      },
    };
    message.editHistory = [
      {
        timestamp: Date.now(),
        received_at: Date.now(),
        bodyAttachment: message.bodyAttachment,
        attachments: message.attachments,
        preview: message.preview,
        quote: message.quote,
      },
      {
        timestamp: Date.now(),
        received_at: Date.now(),
        bodyAttachment: composeBodyAttachment(),
        attachments: [composeAttachment(), composeAttachment()],
        preview: [
          {
            url: 'url',
            image: composeAttachment(),
          },
        ],
        quote: {
          id: Date.now(),
          isViewOnce: false,
          referencedMessageNotFound: false,
          attachments: [
            {
              contentType: IMAGE_JPEG,
              thumbnail: composeAttachment(),
            },
          ],
        },
      },
    ];
    return message;
  }

  describe('isSafeToDeleteAttachment', () => {
    beforeEach(async () => {
      await writeFiles(5, 'attachment');
    });

    it('is safe to delete if no references', async () => {
      assert.isTrue(await DataReader.isAttachmentSafeToDelete('attachment0'));
    });
    it('is not safe to delete if a message references it', async () => {
      const attachment1: AttachmentType = {
        size: 1,
        contentType: IMAGE_JPEG,
        path: 'attachment0',
        version: 2,
        thumbnail: { size: 1, contentType: IMAGE_JPEG, path: 'attachment1' },
        screenshot: { size: 1, contentType: IMAGE_JPEG, path: 'attachment2' },
        thumbnailFromBackup: {
          size: 1,
          contentType: IMAGE_JPEG,
          path: 'attachment3',
        },
      };

      await DataWriter.saveMessage(
        { ...composeMessage(), attachments: [attachment1] },
        {
          ourAci: generateAci(),
          forceSave: true,
          postSaveUpdates: () => Promise.resolve(),
        }
      );

      assert.isFalse(await DataReader.isAttachmentSafeToDelete('attachment0'));
      assert.isFalse(await DataReader.isAttachmentSafeToDelete('attachment1'));
      assert.isFalse(await DataReader.isAttachmentSafeToDelete('attachment2'));
      assert.isFalse(await DataReader.isAttachmentSafeToDelete('attachment3'));
      assert.isTrue(await DataReader.isAttachmentSafeToDelete('attachment4'));

      assert.deepStrictEqual(await maybeDeleteAttachmentFile('attachment0'), {
        wasDeleted: false,
      });
      assert.deepStrictEqual(await maybeDeleteAttachmentFile('attachment1'), {
        wasDeleted: false,
      });
      assert.deepStrictEqual(await maybeDeleteAttachmentFile('attachment2'), {
        wasDeleted: false,
      });
      assert.deepStrictEqual(await maybeDeleteAttachmentFile('attachment3'), {
        wasDeleted: false,
      });
      assert.deepStrictEqual(await maybeDeleteAttachmentFile('attachment4'), {
        wasDeleted: true,
      });
      assert.sameDeepMembers(listFiles('attachment'), [
        'attachment0',
        'attachment1',
        'attachment2',
        'attachment3',
      ]);
    });

    it('is not safe to delete if the file is protected, even if no references', async () => {
      const attachment = {
        size: 1,
        version: 2,
        contentType: IMAGE_JPEG,
        plaintextHash: testPlaintextHash(),
        path: 'attachment0',
        thumbnail: { size: 1, contentType: IMAGE_JPEG, path: 'attachment1' },
        screenshot: { size: 1, contentType: IMAGE_JPEG, path: 'attachment2' },
        // thumbnailFromBackup is not protected
        thumbnailFromBackup: {
          size: 1,
          contentType: IMAGE_JPEG,
          path: 'attachment3',
        },
      } as const;
      const message = { ...composeMessage(), attachments: [attachment] };

      await DataWriter.saveMessage(message, {
        ourAci: generateAci(),
        forceSave: true,
        postSaveUpdates: () => Promise.resolve(),
      });

      await DataWriter.getAndProtectExistingAttachmentPath({
        plaintextHash: attachment.plaintextHash,
        version: 2,
        contentType: attachment.contentType,
      });

      await DataWriter.removeMessageById(message.id, {
        cleanupMessages: () => Promise.resolve(),
      });

      assert.isUndefined(await DataReader.getMessageById(message.id));

      assert.isFalse(await DataReader.isAttachmentSafeToDelete('attachment0'));
      assert.isFalse(await DataReader.isAttachmentSafeToDelete('attachment1'));
      assert.isFalse(await DataReader.isAttachmentSafeToDelete('attachment2'));
      assert.isTrue(await DataReader.isAttachmentSafeToDelete('attachment3'));
      assert.isTrue(await DataReader.isAttachmentSafeToDelete('attachment4'));
    });
  });

  describe('cleanupAllMessageAttachmentFiles', () => {
    it('deletes all referenced files, including those in editHistory', async () => {
      await writeFiles(NUM_ATTACHMENT_FILES_IN_MESSAGE + 3, 'attachment');
      await writeFiles(NUM_DOWNLOAD_FILES_IN_MESSAGE + 3, 'download');
      const message = composeMessageWithAllAttachments();

      await cleanupAllMessageAttachmentFiles(message);

      assert.strictEqual(attachmentIndex, NUM_ATTACHMENT_FILES_IN_MESSAGE);
      assert.strictEqual(downloadIndex, NUM_DOWNLOAD_FILES_IN_MESSAGE);

      assert.sameDeepMembers(listFiles('attachment'), [
        'attachment42',
        'attachment43',
        'attachment44',
      ]);

      assert.sameDeepMembers(listFiles('download'), [
        'download12',
        'download13',
        'download14',
      ]);
    });

    it('does not delete any attachment file if message is still saved, but does cleanup downloads', async () => {
      await writeFiles(NUM_ATTACHMENT_FILES_IN_MESSAGE, 'attachment');
      await writeFiles(NUM_DOWNLOAD_FILES_IN_MESSAGE, 'download');
      const message = composeMessageWithAllAttachments();
      assert.strictEqual(attachmentIndex, NUM_ATTACHMENT_FILES_IN_MESSAGE);
      assert.strictEqual(downloadIndex, NUM_DOWNLOAD_FILES_IN_MESSAGE);
      await DataWriter.saveMessage(message, {
        forceSave: true,
        ourAci: generateAci(),
        postSaveUpdates: () => Promise.resolve(),
      });

      await cleanupAllMessageAttachmentFiles(message);

      assert.strictEqual(
        listFiles('attachment').length,
        NUM_ATTACHMENT_FILES_IN_MESSAGE
      );
      assert.strictEqual(listFiles('download').length, 0);
    });

    it('does not delete an attachment file if referenced by another message', async () => {
      await writeFiles(NUM_ATTACHMENT_FILES_IN_MESSAGE, 'attachment');
      await writeFiles(NUM_DOWNLOAD_FILES_IN_MESSAGE, 'download');
      const message1 = composeMessageWithAllAttachments();
      const duplicatedAttachment: AttachmentType = message1.attachments?.[0];
      const message2: MessageAttributesType = {
        ...composeMessage(),
        attachments: [duplicatedAttachment],
      };
      assert.strictEqual(attachmentIndex, NUM_ATTACHMENT_FILES_IN_MESSAGE);
      assert.strictEqual(downloadIndex, NUM_DOWNLOAD_FILES_IN_MESSAGE);

      await DataWriter.saveMessage(message2, {
        forceSave: true,
        ourAci: generateAci(),
        postSaveUpdates: () => Promise.resolve(),
      });

      await cleanupAllMessageAttachmentFiles(message1);

      assert.sameDeepMembers(listFiles('attachment'), [
        duplicatedAttachment.path,
        duplicatedAttachment.thumbnail?.path,
        duplicatedAttachment.screenshot?.path,
        duplicatedAttachment.thumbnailFromBackup?.path,
      ]);
      assert.strictEqual(listFiles('download').length, 0);
    });

    it('does not delete an attachment path if protected', async () => {
      await writeFiles(NUM_ATTACHMENT_FILES_IN_MESSAGE, 'attachment');
      await writeFiles(NUM_DOWNLOAD_FILES_IN_MESSAGE, 'download');
      const message1 = composeMessageWithAllAttachments();
      const attachment1: AttachmentType = message1.attachments?.[0];
      const message2 = { ...composeMessage() };

      assert.strictEqual(attachmentIndex, NUM_ATTACHMENT_FILES_IN_MESSAGE);
      assert.strictEqual(downloadIndex, NUM_DOWNLOAD_FILES_IN_MESSAGE);

      strictAssert(attachment1.plaintextHash, 'plaintextHash exists');
      strictAssert(attachment1.version, 'version exists');
      await DataWriter.saveMessage(message1, {
        forceSave: true,
        ourAci: generateAci(),
        postSaveUpdates: () => Promise.resolve(),
      });

      // protect existing attachment paths
      const existingAttachment =
        await DataWriter.getAndProtectExistingAttachmentPath({
          plaintextHash: attachment1.plaintextHash,
          version: attachment1.version,
          contentType: attachment1.contentType,
        });

      assert.strictEqual(existingAttachment?.path, attachment1.path);
      assert.strictEqual(existingAttachment?.localKey, attachment1.localKey);

      // delete existing message (e.g. before the new message using the attachment has
      // been saved)
      await DataWriter.removeMessageById(message1.id, { cleanupMessages });

      await cleanupAllMessageAttachmentFiles(message1);

      assert.sameDeepMembers(listFiles('attachment'), [
        attachment1.path,
        attachment1.thumbnail?.path,
        attachment1.screenshot?.path,
      ]);
      assert.strictEqual(listFiles('download').length, 0);
      await DataWriter.removeMessageById(message2.id, { cleanupMessages });
      await cleanupAllMessageAttachmentFiles(message2);
    });
  });

  describe('cleanupAttachmentFiles', () => {
    beforeEach(async () => {
      await writeFiles(5, 'attachment');
      await writeFiles(5, 'download');
    });

    it('cleans up attachment files', async () => {
      const attachment: AttachmentType = {
        size: 1,
        contentType: IMAGE_JPEG,
        path: 'attachment0',
        version: 2,
        downloadPath: 'download0',
        thumbnail: { size: 1, contentType: IMAGE_JPEG, path: 'attachment1' },
        screenshot: { size: 1, contentType: IMAGE_JPEG, path: 'attachment2' },
        thumbnailFromBackup: {
          size: 1,
          contentType: IMAGE_JPEG,
          path: 'attachment3',
        },
      };
      await cleanupAttachmentFiles(attachment);
      assert.sameDeepMembers(listFiles('attachment'), ['attachment4']);
      assert.sameDeepMembers(listFiles('download'), [
        'download1',
        'download2',
        'download3',
        'download4',
      ]);
    });
    it('does not delete files if referenced', async () => {
      const attachment: AttachmentType = {
        size: 1,
        contentType: IMAGE_JPEG,
        path: 'attachment0',
        version: 2,
        downloadPath: 'download0',
        thumbnail: { size: 1, contentType: IMAGE_JPEG, path: 'attachment1' },
        screenshot: { size: 1, contentType: IMAGE_JPEG, path: 'attachment2' },
        thumbnailFromBackup: {
          size: 1,
          contentType: IMAGE_JPEG,
          path: 'attachment3',
        },
      };

      await DataWriter.saveMessage(
        { ...composeMessage(), attachments: [attachment] },
        {
          ourAci: generateAci(),
          forceSave: true,
          postSaveUpdates: () => Promise.resolve(),
        }
      );
      await cleanupAttachmentFiles(attachment);
      // Only downloadPath gets cleaned up
      assert.sameDeepMembers(listFiles('attachment'), [
        'attachment0',
        'attachment1',
        'attachment2',
        'attachment3',
        'attachment4',
      ]);
      assert.sameDeepMembers(listFiles('download'), [
        'download1',
        'download2',
        'download3',
        'download4',
      ]);
    });

    it('does not delete files if protected', async () => {
      const attachment: AttachmentType = {
        size: 1,
        contentType: IMAGE_JPEG,
        path: 'attachment0',
        version: 2,
        downloadPath: 'download0',
        thumbnail: { size: 1, contentType: IMAGE_JPEG, path: 'attachment1' },
        screenshot: { size: 1, contentType: IMAGE_JPEG, path: 'attachment2' },
        thumbnailFromBackup: {
          size: 1,
          contentType: IMAGE_JPEG,
          path: 'attachment3',
        },
      };

      await DataWriter._protectAttachmentPathFromDeletion('attachment0');
      await cleanupAttachmentFiles(attachment);
      assert.sameDeepMembers(listFiles('attachment'), [
        'attachment0',
        'attachment4',
      ]);
    });
    it('does not delete copied quote thumbnails', async () => {
      const attachment: AttachmentType = {
        size: 1,
        contentType: IMAGE_JPEG,
        path: 'attachment0',
        version: 2,
        copied: true,
      };

      await cleanupAttachmentFiles(attachment);
      // not cleaned up
      assert.sameDeepMembers(listFiles('attachment'), [
        'attachment0',
        'attachment1',
        'attachment2',
        'attachment3',
        'attachment4',
      ]);

      // sanity check: if not copied, gets cleaned up
      await cleanupAttachmentFiles({ ...attachment, copied: false });
      assert.sameDeepMembers(listFiles('attachment'), [
        'attachment1',
        'attachment2',
        'attachment3',
        'attachment4',
      ]);
    });
  });
});
