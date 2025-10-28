// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import fsExtra from 'fs-extra';
import { v4 as generateUuid } from 'uuid';
import { readdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { DataWriter } from '../sql/Client.preload.js';
import { missingCaseError } from '../util/missingCaseError.std.js';
import {
  getAbsoluteAttachmentPath,
  getAbsoluteDownloadsPath,
  getAbsoluteDraftPath,
} from '../util/migrations.preload.js';
import {
  getDownloadsPath,
  getDraftPath,
  getPath,
} from '../windows/main/attachments.preload.js';

import { generateAci } from '../types/ServiceId.std.js';
import { IMAGE_JPEG, LONG_MESSAGE } from '../types/MIME.std.js';
import type { MessageAttributesType } from '../model-types.d.ts';

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

describe('cleanupOrphanedAttachments', () => {
  // TODO (DESKTOP-8613): stickers & badges
  beforeEach(async () => {
    await DataWriter.removeAll();

    attachmentIndex = 0;
    downloadIndex = 0;
    await emptyDir(getPath(window.SignalContext.config.userDataPath));
    await emptyDir(getDownloadsPath(window.SignalContext.config.userDataPath));
    await emptyDir(getDraftPath(window.SignalContext.config.userDataPath));
  });

  afterEach(async () => {
    await emptyDir(getPath(window.SignalContext.config.userDataPath));
    await emptyDir(getDownloadsPath(window.SignalContext.config.userDataPath));
    await emptyDir(getDraftPath(window.SignalContext.config.userDataPath));
  });

  function getAttachmentFilePath() {
    attachmentIndex += 1;
    return `attachment${attachmentIndex}`;
  }
  function getDownloadFilePath() {
    downloadIndex += 1;
    return `download${downloadIndex}`;
  }

  function composeAttachment() {
    return {
      contentType: IMAGE_JPEG,
      size: 128,
      path: getAttachmentFilePath(),
      downloadPath: getDownloadFilePath(),
      thumbnail: {
        contentType: IMAGE_JPEG,
        size: 128,
        path: getAttachmentFilePath(),
      },
      screenshot: {
        contentType: IMAGE_JPEG,
        size: 128,
        path: getAttachmentFilePath(),
      },
      thumbnailFromBackup: {
        contentType: IMAGE_JPEG,
        size: 128,
        path: getAttachmentFilePath(),
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

  it('deletes paths if not referenced', async () => {
    await writeFiles(2, 'attachment');
    await writeFiles(2, 'draft');
    await writeFiles(2, 'download');

    assert.sameDeepMembers(listFiles('attachment'), [
      'attachment0',
      'attachment1',
    ]);
    assert.sameDeepMembers(listFiles('draft'), ['draft0', 'draft1']);
    assert.sameDeepMembers(listFiles('download'), ['download0', 'download1']);

    await DataWriter.cleanupOrphanedAttachments({ _block: true });

    assert.sameDeepMembers(listFiles('attachment'), []);
    assert.sameDeepMembers(listFiles('draft'), []);
    assert.sameDeepMembers(listFiles('download'), []);
  });

  it('does not delete conversation avatar and profileAvatar paths', async () => {
    await writeFiles(6, 'attachment');

    await DataWriter.saveConversation({
      id: generateUuid(),
      type: 'private',
      version: 2,
      expireTimerVersion: 2,
      avatar: {
        path: 'attachment0',
      },
      profileAvatar: {
        path: 'attachment1',
      },
    });

    await DataWriter.cleanupOrphanedAttachments({ _block: true });

    assert.sameDeepMembers(listFiles('attachment'), [
      'attachment0',
      'attachment1',
    ]);
  });

  describe('message attachments', () => {
    // Update these if more paths are added to composeMessageWithAllAttachments
    const NUM_ATTACHMENT_FILES_IN_MESSAGE = 26;
    const NUM_DOWNLOAD_FILES_IN_MESSAGE = 8;
    function composeMessageWithAllAttachments(): MessageAttributesType {
      return {
        id: generateUuid(),
        type: 'outgoing',
        sent_at: Date.now(),
        timestamp: Date.now(),
        received_at: Date.now(),
        conversationId: generateUuid(),
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
        editHistory: [
          {
            timestamp: Date.now(),
            received_at: Date.now(),
            bodyAttachment: composeBodyAttachment(),
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
    }

    it('does not delete message attachments (including thumbnails, previews, avatars, etc.)', async () => {
      await writeFiles(NUM_ATTACHMENT_FILES_IN_MESSAGE + 5, 'attachment');
      await writeFiles(NUM_DOWNLOAD_FILES_IN_MESSAGE + 5, 'download');

      await DataWriter.saveMessage(composeMessageWithAllAttachments(), {
        ourAci: generateAci(),
        forceSave: true,
        postSaveUpdates: () => Promise.resolve(),
      });

      await DataWriter.cleanupOrphanedAttachments({ _block: true });

      assert.strictEqual(attachmentIndex, NUM_ATTACHMENT_FILES_IN_MESSAGE);
      assert.strictEqual(downloadIndex, NUM_DOWNLOAD_FILES_IN_MESSAGE);

      const attachmentFiles = listFiles('attachment');
      const downloadFiles = listFiles('download');

      assert.strictEqual(
        attachmentFiles.length,
        NUM_ATTACHMENT_FILES_IN_MESSAGE
      );
      assert.sameDeepMembers(
        attachmentFiles,
        new Array(attachmentIndex)
          .fill(null)
          .map((_, idx) => `attachment${idx + 1}`)
      );

      assert.strictEqual(downloadFiles.length, NUM_DOWNLOAD_FILES_IN_MESSAGE);
      assert.sameDeepMembers(
        downloadFiles,
        new Array(downloadIndex)
          .fill(null)
          .map((_, idx) => `download${idx + 1}`)
      );
    });

    it('works with non-normalized message attachments', async () => {
      await writeFiles(NUM_ATTACHMENT_FILES_IN_MESSAGE + 5, 'attachment');
      await writeFiles(NUM_DOWNLOAD_FILES_IN_MESSAGE + 5, 'download');

      await DataWriter.saveMessage(composeMessageWithAllAttachments(), {
        ourAci: generateAci(),
        forceSave: true,
        // Save one with attachments not normalized
        _testOnlyAvoidNormalizingAttachments: true,
        postSaveUpdates: () => Promise.resolve(),
      });

      await DataWriter.cleanupOrphanedAttachments({ _block: true });

      assert.strictEqual(attachmentIndex, NUM_ATTACHMENT_FILES_IN_MESSAGE);
      assert.strictEqual(downloadIndex, NUM_DOWNLOAD_FILES_IN_MESSAGE);

      const attachmentFiles = listFiles('attachment');
      const downloadFiles = listFiles('download');

      assert.strictEqual(
        attachmentFiles.length,
        NUM_ATTACHMENT_FILES_IN_MESSAGE
      );
      assert.sameDeepMembers(
        attachmentFiles,
        new Array(attachmentIndex)
          .fill(null)
          .map((_, idx) => `attachment${idx + 1}`)
      );

      assert.strictEqual(downloadFiles.length, NUM_DOWNLOAD_FILES_IN_MESSAGE);
      assert.sameDeepMembers(
        downloadFiles,
        new Array(downloadIndex)
          .fill(null)
          .map((_, idx) => `download${idx + 1}`)
      );
    });

    it('will NOT delete copied quote attachments if there is at least one strong reference', async () => {
      await writeFiles(10, 'attachment');

      const quotedMessage = {
        id: generateUuid(),
        type: 'outgoing',
        sent_at: Date.now(),
        timestamp: Date.now(),
        received_at: Date.now(),
        conversationId: generateUuid(),
        attachments: [
          {
            contentType: IMAGE_JPEG,
            size: 128,
            path: 'attachment1',
            thumbnail: {
              contentType: IMAGE_JPEG,
              size: 42,
              // strong reference
              path: 'attachment2',
            },
          },
        ],
      } as const;

      const quotingMessage = {
        id: generateUuid(),
        type: 'outgoing',
        sent_at: Date.now(),
        timestamp: Date.now(),
        received_at: Date.now(),
        conversationId: generateUuid(),
        quote: {
          id: quotedMessage.sent_at,
          isViewOnce: false,
          referencedMessageNotFound: false,
          attachments: [
            {
              contentType: IMAGE_JPEG,
              thumbnail: {
                contentType: IMAGE_JPEG,
                size: 42,
                // weak (copied) reference
                path: 'attachment2',
                copied: true,
              },
            },
          ],
        },
      } as const;

      // Make sure we constructed the test correctly: both attachments reference the same
      // path on disk
      assert.strictEqual(
        quotedMessage.attachments[0].thumbnail.path,
        quotingMessage.quote.attachments[0].thumbnail.path
      );

      await DataWriter.saveMessages([quotedMessage, quotingMessage], {
        ourAci: generateAci(),
        forceSave: true,
        postSaveUpdates: () => Promise.resolve(),
      });

      await DataWriter.cleanupOrphanedAttachments({ _block: true });

      const attachmentFilesLeftOnDisk = listFiles('attachment');

      assert.strictEqual(attachmentFilesLeftOnDisk.length, 2);

      assert.sameDeepMembers(attachmentFilesLeftOnDisk, [
        'attachment1',
        'attachment2',
      ]);
    });

    it('will delete quote attachments if there are only weak references', async () => {
      await writeFiles(10, 'attachment');

      const quotingMessage = {
        id: generateUuid(),
        type: 'outgoing',
        sent_at: Date.now(),
        timestamp: Date.now(),
        received_at: Date.now(),
        conversationId: generateUuid(),
        quote: {
          id: Date.now(),
          isViewOnce: false,
          referencedMessageNotFound: false,
          attachments: [
            {
              contentType: IMAGE_JPEG,
              thumbnail: {
                contentType: IMAGE_JPEG,
                size: 42,
                path: 'attachment1',
                copied: true,
              },
            },
          ],
        },
      } as const;

      await DataWriter.saveMessage(quotingMessage, {
        ourAci: generateAci(),
        forceSave: true,
        postSaveUpdates: () => Promise.resolve(),
      });

      await DataWriter.cleanupOrphanedAttachments({ _block: true });

      const attachmentFilesLeftOnDisk = listFiles('attachment');

      assert.strictEqual(attachmentFilesLeftOnDisk.length, 0);
    });
  });
});
