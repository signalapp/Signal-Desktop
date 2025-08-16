// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { emptyDir, ensureFile } from 'fs-extra';
import { v4 as generateUuid } from 'uuid';
import { readdirSync } from 'fs';
import { dirname } from 'path';

import { DataWriter } from '../sql/Client';
import { missingCaseError } from '../util/missingCaseError';
import {
  getDownloadsPath,
  getDraftPath,
  getPath,
} from '../windows/main/attachments';

import { generateAci } from '../types/ServiceId';
import { IMAGE_JPEG, LONG_MESSAGE } from '../types/MIME';

function getAbsolutePath(
  path: string,
  type: 'attachment' | 'download' | 'draft'
) {
  switch (type) {
    case 'attachment':
      return window.Signal.Migrations.getAbsoluteAttachmentPath(path);
    case 'download':
      return window.Signal.Migrations.getAbsoluteDownloadsPath(path);
    case 'draft':
      return window.Signal.Migrations.getAbsoluteDraftPath(path);
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
    await writeFile(`file${i}`, type);
  }
}

function listFiles(type: 'attachment' | 'download' | 'draft'): Array<string> {
  return readdirSync(dirname(getAbsolutePath('fakename', type)));
}

describe('cleanupOrphanedAttachments', () => {
  // TODO (DESKTOP-8613): stickers & badges
  beforeEach(async () => {
    await DataWriter.removeAll();
    await emptyDir(getPath(window.SignalContext.config.userDataPath));
    await emptyDir(getDownloadsPath(window.SignalContext.config.userDataPath));
    await emptyDir(getDraftPath(window.SignalContext.config.userDataPath));
  });

  afterEach(async () => {
    await emptyDir(getPath(window.SignalContext.config.userDataPath));
    await emptyDir(getDownloadsPath(window.SignalContext.config.userDataPath));
    await emptyDir(getDraftPath(window.SignalContext.config.userDataPath));
  });

  it('deletes paths if not referenced', async () => {
    await writeFiles(2, 'attachment');
    await writeFiles(2, 'draft');
    await writeFiles(2, 'download');

    assert.sameDeepMembers(listFiles('attachment'), ['file0', 'file1']);
    assert.sameDeepMembers(listFiles('draft'), ['file0', 'file1']);
    assert.sameDeepMembers(listFiles('download'), ['file0', 'file1']);

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
        path: 'file0',
      },
      profileAvatar: {
        path: 'file1',
      },
    });

    await DataWriter.cleanupOrphanedAttachments({ _block: true });

    assert.sameDeepMembers(listFiles('attachment'), ['file0', 'file1']);
  });

  it('does not delete message attachments (including thumbnails, previews, avatars, etc.)', async () => {
    await writeFiles(20, 'attachment');
    await writeFiles(6, 'download');

    // Save with legacy (un-normalized) sattachment format (attachments in JSON)
    await DataWriter.saveMessage(
      {
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
            path: 'file0',
            downloadPath: 'file0',
            thumbnail: {
              contentType: IMAGE_JPEG,
              size: 128,
              path: 'file1',
            },
            screenshot: {
              contentType: IMAGE_JPEG,
              size: 128,
              path: 'file2',
            },
            thumbnailFromBackup: {
              contentType: IMAGE_JPEG,
              size: 128,
              path: 'file3',
            },
          },
        ],
      },
      {
        ourAci: generateAci(),
        forceSave: true,
        _testOnlyAvoidNormalizingAttachments: true,
        postSaveUpdates: () => Promise.resolve(),
      }
    );

    // Save one with attachments normalized
    await DataWriter.saveMessage(
      {
        id: generateUuid(),
        type: 'outgoing',
        sent_at: Date.now(),
        timestamp: Date.now(),
        received_at: Date.now(),
        conversationId: generateUuid(),
        bodyAttachment: {
          contentType: IMAGE_JPEG,
          size: 128,
          path: 'file4',
        },
        contact: [
          {
            avatar: {
              isProfile: false,
              avatar: {
                contentType: IMAGE_JPEG,
                size: 128,
                path: 'file5',
              },
            },
          },
        ],
        preview: [
          {
            url: 'url',
            image: {
              contentType: IMAGE_JPEG,
              size: 128,
              path: 'file6',
            },
          },
        ],
        editHistory: [
          {
            timestamp: Date.now(),
            received_at: Date.now(),
            bodyAttachment: {
              contentType: LONG_MESSAGE,
              size: 128,
              path: 'file7',
            },
          },
        ],
        quote: {
          id: Date.now(),
          isViewOnce: false,
          referencedMessageNotFound: false,
          attachments: [
            {
              contentType: IMAGE_JPEG,

              thumbnail: {
                contentType: IMAGE_JPEG,
                size: 128,
                path: 'file8',
              },
            },
          ],
        },
        sticker: {
          packId: 'packId',
          stickerId: 42,
          packKey: 'packKey',
          data: {
            contentType: IMAGE_JPEG,
            size: 128,
            path: 'file9',
            thumbnail: {
              contentType: IMAGE_JPEG,
              size: 128,
              path: 'file10',
            },
          },
        },
      },
      {
        ourAci: generateAci(),
        forceSave: true,
        postSaveUpdates: () => Promise.resolve(),
      }
    );

    await DataWriter.cleanupOrphanedAttachments({ _block: true });

    assert.sameDeepMembers(listFiles('attachment'), [
      'file0',
      'file1',
      'file2',
      'file3',
      'file4',
      'file5',
      'file6',
      'file7',
      'file8',
      'file9',
      'file10',
    ]);
    assert.sameDeepMembers(listFiles('download'), ['file0']);
  });
});
