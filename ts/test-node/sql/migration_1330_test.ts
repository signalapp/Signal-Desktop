// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateGuid } from 'uuid';

import {
  dequeueOldestSyncTasks,
  saveSyncTasks,
  incrementAllSyncTaskAttempts,
} from '../../sql/Server';
import type { WritableDB } from '../../sql/Interface';
import { updateToVersion, createDB } from './helpers';

import type { SyncTaskType } from '../../util/syncTasks';

describe('SQL/updateToSchemaVersion1330', () => {
  let db: WritableDB;
  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 1330);
  });

  afterEach(() => {
    db.close();
  });

  describe('Sync Tasks task index', () => {
    it('uses the task index for queries', () => {
      const { detail } = db
        .prepare(
          `
            EXPLAIN QUERY PLAN
            SELECT rowid, * FROM syncTasks
            WHERE rowid > 0 AND type IN ('delete-converation', 'delete-local-conversation')
            ORDER BY rowid ASC
            LIMIT 10000
        `
        )
        .get();
      assert.include(detail, 'USING INDEX syncTasks_type');
    });
  });

  describe('#dequeueOldestSyncTasks', () => {
    it('returns and increments tasks by type', () => {
      const now = Date.now();
      const expected: Array<SyncTaskType> = [
        {
          id: generateGuid(),
          attempts: 1,
          createdAt: now + 1,
          data: {
            jsonField: 'one',
          },
          envelopeId: generateGuid(),
          sentAt: 1,
          type: 'Delivery',
        },
        {
          id: generateGuid(),
          attempts: 2,
          createdAt: now + 2,
          data: {
            jsonField: 'two',
          },
          envelopeId: generateGuid(),
          sentAt: 2,
          type: 'delete-local-conversation',
        },
        {
          id: generateGuid(),
          attempts: 3,
          createdAt: now + 3,
          data: {
            jsonField: 'three',
          },
          envelopeId: generateGuid(),
          sentAt: 3,
          type: 'delete-conversation',
        },
      ];

      saveSyncTasks(db, expected);

      const deleteTasks = dequeueOldestSyncTasks(db, {
        previousRowId: null,
        syncTaskTypes: ['delete-conversation', 'delete-local-conversation'],
        incrementAttempts: true,
      });
      assert.deepEqual(
        [
          { ...expected[1], attempts: 3 },
          { ...expected[2], attempts: 4 },
        ],
        deleteTasks.tasks
      );

      const allTasks = dequeueOldestSyncTasks(db, {
        previousRowId: 0,
        incrementAttempts: false,
      });

      assert.deepEqual(allTasks.tasks[0], expected[0]);
    });
  });

  describe('#incrementAllSyncTaskAttempts', () => {
    it('increments all sync task attempts', () => {
      const now = Date.now();
      const expected: Array<SyncTaskType> = [
        {
          id: generateGuid(),
          attempts: 1,
          createdAt: now + 1,
          data: {
            jsonField: 'one',
            data: 1,
          },
          envelopeId: 'envelope-id-1',
          sentAt: 1,
          type: 'delete-conversation',
        },
        {
          id: generateGuid(),
          attempts: 2,
          createdAt: now + 2,
          data: {
            jsonField: 'two',
            data: 2,
          },
          envelopeId: 'envelope-id-2',
          sentAt: 2,
          type: 'delete-conversation',
        },
        {
          id: generateGuid(),
          attempts: 3,
          createdAt: now + 3,
          data: {
            jsonField: 'three',
            data: 3,
          },
          envelopeId: 'envelope-id-3',
          sentAt: 3,
          type: 'delete-conversation',
        },
      ];
      saveSyncTasks(db, expected);

      incrementAllSyncTaskAttempts(db);

      const tasksAfterIncrement = dequeueOldestSyncTasks(db, {
        previousRowId: 0,
        incrementAttempts: false,
      });

      assert.deepEqual(
        [
          { ...expected[0], attempts: 2 },
          { ...expected[1], attempts: 3 },
          { ...expected[2], attempts: 4 },
        ],
        tasksAfterIncrement.tasks
      );
    });
  });
});
