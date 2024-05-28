// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';
import type { ZodSchema } from 'zod';

import * as log from '../logging/log';
import * as DeletesForMe from '../messageModifiers/DeletesForMe';
import {
  deleteMessageSchema,
  deleteConversationSchema,
  deleteLocalConversationSchema,
} from '../textsecure/messageReceiverEvents';

import {
  deleteConversation,
  deleteLocalOnlyConversation,
  getConversationFromTarget,
} from './deleteForMe';
import { drop } from './drop';

const syncTaskDataSchema = z.union([
  deleteMessageSchema,
  deleteConversationSchema,
  deleteLocalConversationSchema,
]);
export type SyncTaskData = z.infer<typeof syncTaskDataSchema>;

export type SyncTaskType = Readonly<{
  id: string;
  attempts: number;
  createdAt: number;
  data: unknown;
  envelopeId: string;
  sentAt: number;
  type: SyncTaskData['type'];
}>;

const SCHEMAS_BY_TYPE: Record<SyncTaskData['type'], ZodSchema> = {
  'delete-message': deleteMessageSchema,
  'delete-conversation': deleteConversationSchema,
  'delete-local-conversation': deleteLocalConversationSchema,
};

function toLogId(task: SyncTaskType) {
  return `task=${task.id},timestamp:${task},type=${task.type},envelopeId=${task.envelopeId}`;
}

export async function queueSyncTasks(
  tasks: Array<SyncTaskType>,
  removeSyncTaskById: (id: string) => Promise<void>
): Promise<void> {
  const logId = 'queueSyncTasks';

  for (let i = 0, max = tasks.length; i < max; i += 1) {
    const task = tasks[i];
    const { id, envelopeId, type, sentAt, data } = task;
    const innerLogId = `${logId}(${toLogId(task)})`;

    const schema = SCHEMAS_BY_TYPE[type];
    if (!schema) {
      log.error(`${innerLogId}: Schema not found. Deleting.`);
      // eslint-disable-next-line no-await-in-loop
      await removeSyncTaskById(id);
      return;
    }
    const parseResult = syncTaskDataSchema.safeParse(data);
    if (!parseResult.success) {
      log.error(
        `${innerLogId}: Failed to parse. Deleting. Error: ${parseResult.error}`
      );
      // eslint-disable-next-line no-await-in-loop
      await removeSyncTaskById(id);
      return;
    }

    const { data: parsed } = parseResult;

    if (parsed.type === 'delete-message') {
      // eslint-disable-next-line no-await-in-loop
      await DeletesForMe.onDelete({
        conversation: parsed.conversation,
        envelopeId,
        message: parsed.message,
        syncTaskId: id,
        timestamp: sentAt,
      });
    } else if (parsed.type === 'delete-conversation') {
      const {
        conversation: targetConversation,
        mostRecentMessages,
        isFullDelete,
      } = parsed;
      const conversation = getConversationFromTarget(targetConversation);
      if (!conversation) {
        log.error(`${innerLogId}: Conversation not found!`);
        continue;
      }
      drop(
        conversation.queueJob(innerLogId, async () => {
          log.info(`${logId}: Starting...`);
          const result = await deleteConversation(
            conversation,
            mostRecentMessages,
            isFullDelete,
            innerLogId
          );
          if (result) {
            await removeSyncTaskById(id);
          }
          log.info(`${logId}: Done, result=${result}`);
        })
      );
    } else if (parsed.type === 'delete-local-conversation') {
      const { conversation: targetConversation } = parsed;
      const conversation = getConversationFromTarget(targetConversation);
      if (!conversation) {
        log.error(`${innerLogId}: Conversation not found!`);
        continue;
      }
      drop(
        conversation.queueJob(innerLogId, async () => {
          log.info(`${logId}: Starting...`);
          const result = await deleteLocalOnlyConversation(
            conversation,
            innerLogId
          );

          // Note: we remove even with a 'false' result because we're only gonna
          //   get more messages in this conversation from here!
          await removeSyncTaskById(id);

          log.info(`${logId}: Done; result=${result}`);
        })
      );
    }
  }
}
