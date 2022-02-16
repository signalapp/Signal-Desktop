// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from 'better-sqlite3';

import type { LoggerType } from '../../types/Logging';
import { isRecord } from '../../util/isRecord';
import {
  getJobsInQueueSync,
  getMessageByIdSync,
  insertJobSync,
} from '../Server';

export default function updateToSchemaVersion51(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 51) {
    return;
  }

  db.transaction(() => {
    const deleteJobsInQueue = db.prepare(
      'DELETE FROM jobs WHERE queueType = $queueType'
    );

    // First, make sure that reactions job data has a type and conversationId
    const reactionsJobs = getJobsInQueueSync(db, 'reactions');
    deleteJobsInQueue.run({ queueType: 'reactions' });

    reactionsJobs.forEach(job => {
      const { data, id } = job;

      if (!isRecord(data)) {
        logger.warn(
          `updateToSchemaVersion51: reactions queue job ${id} was missing valid data`
        );
        return;
      }

      const { messageId } = data;
      if (typeof messageId !== 'string') {
        logger.warn(
          `updateToSchemaVersion51: reactions queue job ${id} had a non-string messageId`
        );
        return;
      }

      const message = getMessageByIdSync(db, messageId);
      if (!message) {
        logger.warn(
          `updateToSchemaVersion51: Unable to find message for reaction job ${id}`
        );
        return;
      }

      const { conversationId } = message;
      if (typeof conversationId !== 'string') {
        logger.warn(
          `updateToSchemaVersion51: reactions queue job ${id} had a non-string conversationId`
        );
        return;
      }

      const newJob = {
        ...job,
        queueType: 'conversation',
        data: {
          ...data,
          type: 'Reaction',
          conversationId,
        },
      };

      insertJobSync(db, newJob);
    });

    // Then make sure all normal send job data has a type
    const normalSendJobs = getJobsInQueueSync(db, 'normal send');
    deleteJobsInQueue.run({ queueType: 'normal send' });

    normalSendJobs.forEach(job => {
      const { data, id } = job;

      if (!isRecord(data)) {
        logger.warn(
          `updateToSchemaVersion51: normal send queue job ${id} was missing valid data`
        );
        return;
      }

      const newJob = {
        ...job,
        queueType: 'conversation',
        data: {
          ...data,
          type: 'NormalMessage',
        },
      };

      insertJobSync(db, newJob);
    });

    db.pragma('user_version = 51');
  })();

  logger.info('updateToSchemaVersion51: success!');
}
