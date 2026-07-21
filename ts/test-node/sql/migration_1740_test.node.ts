// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import fsExtra from 'fs-extra';

import {
  createDB,
  getTableData,
  insertData,
  updateToVersion,
} from './helpers.node.ts';

import type { WritableDB } from '../../sql/Interface.std.ts';
import {
  createAbsolutePathGetter,
  type ConversationAttributesType,
} from '../../sql/migrations/1740-cleanup-groups.node.ts';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { mkdtempSync, readdirSync, rmdirSync } from 'node:fs';
import { missingCaseError } from '../../util/missingCaseError.std.ts';
import {
  getAttachmentsPath,
  getAvatarsPath,
  getDraftPath,
} from '../../../app/attachments.node.ts';

const { emptyDir, ensureFile } = fsExtra;

type TestAttachmentTypes = 'attachment' | 'avatar' | 'draft';

describe('SQL/updateToSchemaVersion1740', () => {
  let db: WritableDB;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'Signal'));
    db = createDB();
    updateToVersion(db, 1730, { userDataPath: tempDir });
  });

  afterEach(async () => {
    db.close();
    await emptyDir(tempDir);
    rmdirSync(tempDir);
  });

  it('cleans up only left/terminated and deleted groups', async () => {
    const attachmentsPath = getAttachmentsPath(tempDir);
    const avatarsPath = getAvatarsPath(tempDir);
    const draftPath = getDraftPath(tempDir);

    const getAbsoluteAttachmentPath = createAbsolutePathGetter(attachmentsPath);
    const getAbsoluteAvatarPath = createAbsolutePathGetter(avatarsPath);
    const getAbsoluteDraftPath = createAbsolutePathGetter(draftPath);

    function getAbsolutePath(path: string, type: TestAttachmentTypes) {
      switch (type) {
        case 'attachment':
          return getAbsoluteAttachmentPath(path);
        case 'avatar':
          return getAbsoluteAvatarPath(path);
        case 'draft':
          return getAbsoluteDraftPath(path);
        default:
          throw missingCaseError(type);
      }
    }

    async function writeFile(path: string, type: TestAttachmentTypes) {
      await ensureFile(getAbsolutePath(path, type));
    }

    async function writeFiles(num: number, type: TestAttachmentTypes) {
      for (let i = 0; i < num; i += 1) {
        // oxlint-disable-next-line no-await-in-loop
        await writeFile(`${type}${i}`, type);
      }
    }

    function listFiles(type: TestAttachmentTypes): Array<string> {
      return readdirSync(dirname(getAbsolutePath('not used', type)));
    }

    await writeFiles(3, 'attachment');
    await writeFiles(6, 'draft');
    await writeFiles(6, 'avatar');

    const now = Date.now();
    const initialData: Array<{
      id: string;
      type: string;
      name: string;
      members?: string;
      active_at?: number;
      expireTimerVersion: number;
      json: Partial<ConversationAttributesType>;
    }> = [
      {
        id: 'c0',
        type: 'private',
        name: 'John',
        expireTimerVersion: 1,
        json: {
          id: 'c0',
          type: 'private',
          timestamp: now,
          name: 'John',
        },
      },
      {
        id: 'c1',
        type: 'private',
        name: 'John, deleted',
        expireTimerVersion: 1,
        json: {
          id: 'c1',
          type: 'private',
          timestamp: now,
          name: 'John',
          messagesDeleted: true,
        },
      },
      {
        id: 'c2',
        type: 'group',
        name: 'GV1 group',
        members: '1 2 3',
        expireTimerVersion: 1,
        json: {
          id: 'c2',
          type: 'group',
          groupId: '249qw4kh23492p34',
          timestamp: now,
          name: 'GV1 group',
          members: ['1', '2', '3'],
        },
      },
      {
        id: 'c3',
        type: 'group',
        active_at: now,
        name: 'GV2 group with activeAt',
        members: '1 2 3',
        expireTimerVersion: 1,
        json: {
          id: 'c3',
          type: 'group',
          groupId: getRandomGroupId(),
          groupVersion: 2,
          name: 'GV2 group with activeAt',
          timestamp: now,
          active_at: now,
          members: ['1', '2', '3'],
        },
      },
      {
        id: 'c4',
        type: 'group',
        name: 'GV2 group with messagesDeleted',
        members: '1 2 3',
        expireTimerVersion: 1,
        json: {
          id: 'c4',
          type: 'group',
          groupId: getRandomGroupId(),
          groupVersion: 2,
          name: 'GV2 group with messagesDeleted',
          timestamp: now,
          members: ['1', '2', '3'],
        },
      },
      {
        id: 'c5',
        type: 'group',
        name: 'GV2 group, left',
        members: '1 2 3',
        expireTimerVersion: 1,
        json: {
          id: 'c5',
          type: 'group',
          groupId: getRandomGroupId(),
          groupVersion: 2,
          name: 'GV2 group, left',
          timestamp: now,
          active_at: now,
          members: ['1', '2', '3'],
          left: true,
        },
      },
      {
        id: 'c6',
        type: 'group',
        active_at: now,
        name: 'GV2 group, terminated',
        members: '1 2 3',
        expireTimerVersion: 1,
        json: {
          id: 'c6',
          type: 'group',
          groupId: getRandomGroupId(),
          groupVersion: 2,
          name: 'GV2 group, terminated',
          timestamp: now,
          active_at: now,
          members: ['1', '2', '3'],
          terminated: true,
        },
      },
      {
        id: 'c7',
        type: 'group',
        name: 'GV2 group, deleted but not left or terminated',
        members: '1 2 3',
        expireTimerVersion: 1,
        json: {
          id: 'c7',
          type: 'group',
          groupId: getRandomGroupId(),
          avatar: {
            path: 'attachment0',
          },
          draftAttachments: [{ path: 'draft0' }, { screenshotPath: 'draft1' }],
          avatars: [
            { id: 0, imagePath: 'avatar0' },
            { id: 1 },
            { id: 2, imagePath: 'avatar1' },
          ],
          groupVersion: 2,
          name: 'GV2 group, deleted but not left or terminated',
          timestamp: now,
          messagesDeleted: true,
          members: ['1', '2', '3'],
        },
      },
      {
        id: 'c8',
        type: 'group',
        name: 'GV2 group, left and deleted - will be erased',
        members: '1 2 3',
        expireTimerVersion: 1,
        json: {
          id: 'c8',
          type: 'group',
          groupId: getRandomGroupId(),
          groupVersion: 2,
          name: 'GV2 group, left and deleted - will be erased',
          timestamp: now,
          avatar: {
            path: 'attachment1',
          },
          draftAttachments: [{ path: 'draft2' }, { screenshotPath: 'draft3' }],
          avatars: [
            { id: 0, imagePath: 'avatar2' },
            { id: 1 },
            { id: 2, imagePath: 'avatar3' },
          ],
          messagesDeleted: true,
          members: ['1', '2', '3'],
          left: true,
        },
      },
      {
        id: 'c9',
        type: 'group',
        name: 'GV2 group, terminated and deleted - will be erased',
        members: '1 2 3',
        expireTimerVersion: 1,
        json: {
          id: 'c9',
          type: 'group',
          groupId: getRandomGroupId(),
          groupVersion: 2,
          name: 'GV2 group, terminated and deleted - will be erased',
          timestamp: now,
          avatar: {
            path: 'attachment2',
          },
          draftAttachments: [{ path: 'draft4' }, { screenshotPath: 'draft5' }],
          avatars: [
            { id: 0, imagePath: 'avatar4' },
            { id: 1 },
            { id: 2, imagePath: 'avatar5' },
          ],
          messagesDeleted: true,
          members: ['1', '2', '3'],
          terminated: true,
        },
      },
    ];

    insertData(db, 'conversations', initialData);

    updateToVersion(db, 1740, { userDataPath: tempDir });

    assert.deepStrictEqual(getTableData(db, 'conversations'), [
      initialData[0],
      initialData[1],
      initialData[2],
      initialData[3],
      initialData[4],
      initialData[5],
      initialData[6],
      initialData[7],
      {
        id: 'c8',
        type: 'group',
        expireTimerVersion: 1,
        json: {
          id: 'c8',
          type: 'group',
          groupId: initialData[8]?.json.groupId,
          groupVersion: 2,
          messagesDeleted: true,
          expireTimerVersion: 1,
        },
      },
      {
        id: 'c9',
        type: 'group',
        expireTimerVersion: 1,
        json: {
          id: 'c9',
          type: 'group',
          groupId: initialData[9]?.json.groupId,
          groupVersion: 2,
          messagesDeleted: true,
          expireTimerVersion: 1,
        },
      },
    ]);

    assert.deepEqual(listFiles('attachment'), ['attachment0']);
    assert.deepEqual(listFiles('draft'), ['draft0', 'draft1']);
    assert.deepEqual(listFiles('avatar'), ['avatar0', 'avatar1']);
  });
});

function getRandomGroupId() {
  return randomBytes(32).toBase64();
}
