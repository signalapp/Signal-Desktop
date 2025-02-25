// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';
import type { ZodSchema } from 'zod';

import { drop } from './drop';
import * as log from '../logging/log';
import * as DeletesForMe from '../messageModifiers/DeletesForMe';
import {
  deleteMessageSchema,
  deleteConversationSchema,
  deleteLocalConversationSchema,
  deleteAttachmentSchema,
} from '../textsecure/messageReceiverEvents';
import {
  receiptSyncTaskSchema,
  onReceipt,
} from '../messageModifiers/MessageReceipts';
import {
  deleteConversation,
  deleteLocalOnlyConversation,
  getConversationFromTarget,
} from './deleteForMe';
import {
  onSync as onReadSync,
  readSyncTaskSchema,
} from '../messageModifiers/ReadSyncs';
import {
  onSync as onViewSync,
  viewSyncTaskSchema,
} from '../messageModifiers/ViewSyncs';
import { safeParseUnknown } from './schemas';
import { DataWriter } from '../sql/Client';

const syncTaskDataSchema = z.union([
  deleteMessageSchema,
  deleteConversationSchema,
  deleteLocalConversationSchema,
  deleteAttachmentSchema,
  receiptSyncTaskSchema,
  readSyncTaskSchema,
  viewSyncTaskSchema,
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
  'delete-single-attachment': deleteAttachmentSchema,
  Delivery: receiptSyncTaskSchema,
  Read: receiptSyncTaskSchema,
  View: receiptSyncTaskSchema,
  ReadSync: readSyncTaskSchema,
  ViewSync: viewSyncTaskSchema,
};

function toLogId(task: SyncTaskType) {
  return `type=${task.type},envelopeId=${task.envelopeId}`;
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
      continue;
    }
    const parseResult = safeParseUnknown(syncTaskDataSchema, data);
    if (!parseResult.success) {
      log.error(
        `${innerLogId}: Failed to parse. Deleting. Error: ${parseResult.error}`
      );
      // eslint-disable-next-line no-await-in-loop
      await removeSyncTaskById(id);
      continue;
    }

    const { data: parsed } = parseResult;

    if (parsed.type === 'delete-message') {
      drop(
        DeletesForMe.onDelete({
          conversation: parsed.conversation,
          envelopeId,
          message: parsed.message,
          syncTaskId: id,
          timestamp: sentAt,
        })
      );
    } else if (parsed.type === 'delete-conversation') {
      const {
        conversation: targetConversation,
        mostRecentMessages,
        mostRecentNonExpiringMessages,
        isFullDelete,
      } = parsed;
      const conversation = getConversationFromTarget(targetConversation);
      if (!conversation) {
        log.error(`${innerLogId}: Conversation not found!`);
        continue;
      }
      drop(
        conversation.queueJob(innerLogId, async () => {
          const promises = conversation.getSavePromises();
          log.info(
            `${innerLogId}: Waiting for message saves (${promises.length} items)...`
          );
          await Promise.all(promises);

          log.info(`${innerLogId}: Starting delete...`);
          const result = await deleteConversation(
            conversation,
            mostRecentMessages,
            mostRecentNonExpiringMessages,
            isFullDelete,
            innerLogId
          );
          if (result) {
            await removeSyncTaskById(id);
          }
          log.info(`${innerLogId}: Done, result=${result}`);
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
          const promises = conversation.getSavePromises();
          log.info(
            `${innerLogId}: Waiting for message saves (${promises.length} items)...`
          );
          await Promise.all(promises);

          log.info(`${innerLogId}: Starting delete...`);
          const result = await deleteLocalOnlyConversation(
            conversation,
            innerLogId
          );

          // Note: we remove even with a 'false' result because we're only gonna
          //   get more messages in this conversation from here!
          await removeSyncTaskById(id);

          log.info(`${innerLogId}: Done; result=${result}`);
        })
      );
    } else if (parsed.type === 'delete-single-attachment') {
      drop(
        DeletesForMe.onDelete({
          conversation: parsed.conversation,
          deleteAttachmentData: {
            clientUuid: parsed.clientUuid,
            fallbackDigest: parsed.fallbackDigest,
            fallbackPlaintextHash: parsed.fallbackPlaintextHash,
          },
          envelopeId,
          message: parsed.message,
          syncTaskId: id,
          timestamp: sentAt,
        })
      );
    } else if (
      parsed.type === 'Delivery' ||
      parsed.type === 'Read' ||
      parsed.type === 'View'
    ) {
      drop(
        onReceipt({
          envelopeId,
          receiptSync: parsed,
          syncTaskId: id,
        })
      );
    } else if (parsed.type === 'ReadSync') {
      drop(
        onReadSync({
          envelopeId,
          readSync: parsed,
          syncTaskId: id,
        })
      );
    } else if (parsed.type === 'ViewSync') {
      drop(
        onViewSync({
          envelopeId,
          viewSync: parsed,
          syncTaskId: id,
        })
      );
    } else {
      const parsedType: never = parsed.type;
      log.error(
        `${innerLogId}: Encountered job of type ${parsedType}, removing`
      );
      // eslint-disable-next-line no-await-in-loop
      await removeSyncTaskById(id);
    }
  }

  // Note: There may still be some tasks in the database, but we expect to be
  // called again some time later to process them.
}

async function processSyncTasksBatch(
  logId: string,
  previousRowId: number | null
): Promise<number | null> {
  log.info('syncTasks: Fetching tasks');
  const result = await DataWriter.dequeueOldestSyncTasks({ previousRowId });
  const syncTasks = result.tasks;

  if (syncTasks.length === 0) {
    log.info(`${logId}/syncTasks: No sync tasks to process, stopping`);
  } else {
    log.info(`${logId}/syncTasks: Queueing ${syncTasks.length} sync tasks`);
    await queueSyncTasks(syncTasks, DataWriter.removeSyncTaskById);
  }

  return result.lastRowId;
}

const A_TICK = Promise.resolve();

export async function runAllSyncTasks(): Promise<void> {
  let lastRowId: number | null = null;
  do {
    // eslint-disable-next-line no-await-in-loop
    lastRowId = await processSyncTasksBatch('Startup', lastRowId);
    // eslint-disable-next-line no-await-in-loop
    await A_TICK;
  } while (lastRowId != null);
}
