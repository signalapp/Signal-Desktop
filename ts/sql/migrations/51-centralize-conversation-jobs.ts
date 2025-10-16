// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoggerType } from '../../types/Logging.std.js';
import { isRecord } from '../../util/isRecord.std.js';
import type { WritableDB } from '../Interface.std.js';
import { getJobsInQueue, insertJob } from '../Server.node.js';

export default function updateToSchemaVersion51(
  db: WritableDB,
  logger: LoggerType
): void {
  const deleteJobsInQueue = db.prepare(
    'DELETE FROM jobs WHERE queueType = $queueType'
  );

  // First, make sure that reactions job data has a type and conversationId
  const reactionsJobs = getJobsInQueue(db, 'reactions');
  deleteJobsInQueue.run({ queueType: 'reactions' });

  const getMessageById = db.prepare(
    'SELECT conversationId FROM messages WHERE id IS ?'
  );

  reactionsJobs.forEach(job => {
    const { data, id } = job;

    if (!isRecord(data)) {
      logger.warn(`reactions queue job ${id} was missing valid data`);
      return;
    }

    const { messageId } = data;
    if (typeof messageId !== 'string') {
      logger.warn(`reactions queue job ${id} had a non-string messageId`);
      return;
    }

    const message = getMessageById.get([messageId]);
    if (!message) {
      logger.warn(`Unable to find message for reaction job ${id}`);
      return;
    }

    const { conversationId } = message;
    if (typeof conversationId !== 'string') {
      logger.warn(`reactions queue job ${id} had a non-string conversationId`);
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

    insertJob(db, newJob);
  });

  // Then make sure all normal send job data has a type
  const normalSendJobs = getJobsInQueue(db, 'normal send');
  deleteJobsInQueue.run({ queueType: 'normal send' });

  normalSendJobs.forEach(job => {
    const { data, id } = job;

    if (!isRecord(data)) {
      logger.warn(`normal send queue job ${id} was missing valid data`);
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

    insertJob(db, newJob);
  });
}
