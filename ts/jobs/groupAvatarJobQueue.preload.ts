// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as z from 'zod';
import type { LoggerType } from '../types/Logging.std.js';
import { applyNewAvatar } from '../groups.preload.js';
import { isGroupV2 } from '../util/whatTypeOfConversation.dom.js';
import { DataWriter } from '../sql/Client.preload.js';

import type { JOB_STATUS } from './JobQueue.std.js';
import { JobQueue } from './JobQueue.std.js';
import { jobQueueDatabaseStore } from './JobQueueDatabaseStore.preload.js';
import { parseUnknown } from '../util/schemas.std.js';
import { waitForOnline } from '../util/waitForOnline.dom.js';
import { isOnline } from '../textsecure/WebAPI.preload.js';

const groupAvatarJobDataSchema = z.object({
  conversationId: z.string(),
  newAvatarUrl: z.string().optional(),
});

export type GroupAvatarJobData = z.infer<typeof groupAvatarJobDataSchema>;

export class GroupAvatarJobQueue extends JobQueue<GroupAvatarJobData> {
  protected parseData(data: unknown): GroupAvatarJobData {
    return parseUnknown(groupAvatarJobDataSchema, data);
  }

  protected async run(
    { data }: Readonly<{ data: GroupAvatarJobData; timestamp: number }>,
    { attempt, log }: Readonly<{ attempt: number; log: LoggerType }>
  ): Promise<typeof JOB_STATUS.NEEDS_RETRY | undefined> {
    const { conversationId, newAvatarUrl } = data;
    await waitForOnline({ server: { isOnline } });

    const logId = `groupAvatarJobQueue(${conversationId}, attempt=${attempt})`;

    const convo = window.ConversationController.get(conversationId);
    if (!convo) {
      log.warn(`${logId}: dropping ${conversationId}, not found`);
      return undefined;
    }

    const { attributes } = convo;
    if (!isGroupV2(attributes)) {
      log.warn(`${logId}: dropping ${conversationId}, not a group`);
      return undefined;
    }

    await convo.queueJob('GroupAvatarJobQueue', async () => {
      if (convo.attributes.remoteAvatarUrl !== newAvatarUrl) {
        return;
      }

      // Generate correct attributes patch
      const patch = await applyNewAvatar({
        newAvatarUrl,
        attributes,
        logId,
      });

      convo.set(patch);
      await DataWriter.updateConversation(convo.attributes);
    });

    return undefined;
  }
}

export const groupAvatarJobQueue = new GroupAvatarJobQueue({
  store: jobQueueDatabaseStore,
  queueType: 'groupAvatar',
  maxAttempts: 5,
});
