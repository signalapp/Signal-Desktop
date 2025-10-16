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
  getPath,
} from '../windows/main/attachments.preload.js';

import { IMAGE_JPEG, LONG_MESSAGE } from '../types/MIME.std.js';
import type { MessageAttributesType } from '../model-types.d.ts';
import type { AttachmentType } from '../types/Attachment.std.js';
import { deleteAllAttachmentFilesOnDisk } from '../util/Attachment.std.js';
import {
  getAbsoluteAttachmentPath,
  getAbsoluteDownloadsPath,
  getAbsoluteDraftPath,
  deleteAttachmentData,
  deleteDownloadData,
  deleteExternalMessageFiles,
} from '../util/migrations.preload.js';
import { strictAssert } from '../util/assert.std.js';

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
  for (let i = 1; i <= num; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await writeFile(`${type}${i}`, type);
  }
}

function listFiles(type: 'attachment' | 'download' | 'draft'): Array<string> {
  return readdirSync(dirname(getAbsolutePath('fakename', type)));
}

let attachmentIndex = 0;
let downloadIndex = 0;

describe('Attachment deletion', () => {
  beforeEach(async () => {
    attachmentIndex = 0;
    downloadIndex = 0;
    await emptyDir(getPath(window.SignalContext.config.userDataPath));
    await emptyDir(getDownloadsPath(window.SignalContext.config.userDataPath));
  });

  afterEach(async () => {
    await emptyDir(getPath(window.SignalContext.config.userDataPath));
    await emptyDir(getDownloadsPath(window.SignalContext.config.userDataPath));
  });

  function getAttachmentFilePath() {
    attachmentIndex += 1;
    return `attachment${attachmentIndex}`;
  }
  function getDownloadFilePath() {
    downloadIndex += 1;
    return `download${downloadIndex}`;
  }

  function composeAttachment(): AttachmentType {
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

  it('deleteAllAttachmentFilesOnDisk deletes all paths referenced', async () => {
    await writeFiles(5, 'attachment');
    await writeFiles(3, 'download');

    await deleteAllAttachmentFilesOnDisk({
      deleteAttachmentOnDisk: deleteAttachmentData,
      deleteDownloadOnDisk: deleteDownloadData,
    })(composeAttachment());

    assert.strictEqual(attachmentIndex, 4);
    assert.sameDeepMembers(listFiles('attachment'), ['attachment5']);
    assert.sameDeepMembers(listFiles('download'), ['download2', 'download3']);
  });

  it('deleteAllAttachmentFilesOnDisk does not delete files for copied attachments', async () => {
    await writeFiles(5, 'attachment');
    await writeFiles(5, 'download');

    const attachment = composeAttachment();
    attachment.copied = true;

    await deleteAllAttachmentFilesOnDisk({
      deleteAttachmentOnDisk: deleteAttachmentData,
      deleteDownloadOnDisk: deleteDownloadData,
    })(attachment);

    assert.sameDeepMembers(listFiles('attachment'), [
      'attachment1',
      'attachment2',
      'attachment3',
      'attachment4',
      'attachment5',
    ]);
    assert.sameDeepMembers(listFiles('download'), [
      'download1',
      'download2',
      'download3',
      'download4',
      'download5',
    ]);
  });
  // Update these if more paths are added to composeMessageWithAllAttachments
  const NUM_ATTACHMENT_FILES_IN_MESSAGE = 42;
  const NUM_DOWNLOAD_FILES_IN_MESSAGE = 12;
  function composeMessageWithAllAttachments(): MessageAttributesType {
    const message: MessageAttributesType = {
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

  it('deleteExternalMessageFiles deletes all message attachments, including editHistory', async () => {
    await writeFiles(NUM_ATTACHMENT_FILES_IN_MESSAGE + 3, 'attachment');
    await writeFiles(NUM_DOWNLOAD_FILES_IN_MESSAGE + 3, 'download');
    const message = composeMessageWithAllAttachments();

    await deleteExternalMessageFiles(message);

    assert.strictEqual(attachmentIndex, NUM_ATTACHMENT_FILES_IN_MESSAGE);
    assert.strictEqual(downloadIndex, NUM_DOWNLOAD_FILES_IN_MESSAGE);

    assert.sameDeepMembers(listFiles('attachment'), [
      'attachment43',
      'attachment44',
      'attachment45',
    ]);

    assert.sameDeepMembers(listFiles('download'), [
      'download13',
      'download14',
      'download15',
    ]);
  });

  it('deleteExternalMessageFiles does not delete copied quote attachments', async () => {
    await writeFiles(NUM_ATTACHMENT_FILES_IN_MESSAGE + 3, 'attachment');
    await writeFiles(NUM_DOWNLOAD_FILES_IN_MESSAGE + 3, 'download');
    const message = composeMessageWithAllAttachments();

    const quotedThumbnail = message.quote?.attachments[0].thumbnail;
    strictAssert(quotedThumbnail, 'thumbnail exists');
    quotedThumbnail.copied = true;

    await deleteExternalMessageFiles(message);

    assert.strictEqual(attachmentIndex, NUM_ATTACHMENT_FILES_IN_MESSAGE);
    assert.strictEqual(downloadIndex, NUM_DOWNLOAD_FILES_IN_MESSAGE);

    assert.sameDeepMembers(listFiles('attachment'), [
      quotedThumbnail.path,
      quotedThumbnail.thumbnail?.path,
      quotedThumbnail.thumbnailFromBackup?.path,
      quotedThumbnail.screenshot?.path,
      'attachment43',
      'attachment44',
      'attachment45',
    ]);

    assert.sameDeepMembers(listFiles('download'), [
      quotedThumbnail.downloadPath,
      'download13',
      'download14',
      'download15',
    ]);
  });
});
