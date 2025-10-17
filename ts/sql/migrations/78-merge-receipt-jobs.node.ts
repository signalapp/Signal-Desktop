// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoggerType } from '../../types/Logging.std.js';
import { isRecord } from '../../util/isRecord.std.js';
import type { WritableDB } from '../Interface.std.js';
import { getJobsInQueue, insertJob } from '../Server.node.js';

export default function updateToSchemaVersion78(
  db: WritableDB,
  logger: LoggerType
): void {
  const deleteJobsInQueue = db.prepare(
    'DELETE FROM jobs WHERE queueType = $queueType'
  );

  const queues = [
    {
      queueType: 'delivery receipts',
      jobDataKey: 'deliveryReceipts',
      jobDataIsArray: true,
      newReceiptsType: 'deliveryReceipt',
    },
    {
      queueType: 'read receipts',
      jobDataKey: 'readReceipts',
      jobDataIsArray: true,
      newReceiptsType: 'readReceipt',
    },
    {
      queueType: 'viewed receipts',
      jobDataKey: 'viewedReceipt',
      jobDataIsArray: false,
      newReceiptsType: 'viewedReceipt',
    },
  ];

  const getMessageById = db.prepare(
    'SELECT conversationId FROM messages WHERE id IS ?'
  );

  for (const queue of queues) {
    const prevJobs = getJobsInQueue(db, queue.queueType);
    deleteJobsInQueue.run({ queueType: queue.queueType });

    prevJobs.forEach(job => {
      const { data, id } = job;
      if (!isRecord(data)) {
        logger.warn(
          `${queue.queueType} queue job ${id} was missing valid data`
        );
        return;
      }

      const { messageId } = data;
      if (typeof messageId !== 'string') {
        logger.warn(
          `${queue.queueType} queue job ${id} had a non-string messageId`
        );
        return;
      }

      const message = getMessageById.get([messageId]);
      if (!message) {
        logger.warn(`Unable to find message for ${queue.queueType} job ${id}`);
        return;
      }

      const { conversationId } = message;
      if (typeof conversationId !== 'string') {
        logger.warn(
          `${queue.queueType} queue job ${id} had a non-string conversationId`
        );
        return;
      }

      const oldReceipts = queue.jobDataIsArray
        ? data[queue.jobDataKey]
        : [data[queue.jobDataKey]];

      if (!Array.isArray(oldReceipts)) {
        logger.warn(
          `${queue.queueType} queue job ${id} had a non-array ${queue.jobDataKey}`
        );
        return;
      }

      const newReceipts = [];

      for (const receipt of oldReceipts) {
        if (!isRecord(receipt)) {
          logger.warn(
            `${queue.queueType} queue job ${id} had a non-record receipt`
          );
          continue;
        }

        newReceipts.push({
          ...receipt,
          conversationId,
        });
      }

      const newJob = {
        ...job,
        queueType: 'conversation',
        data: {
          type: 'Receipts',
          conversationId,
          receiptsType: queue.newReceiptsType,
          receipts: newReceipts,
        },
      };

      insertJob(db, newJob);
    });
  }
}
