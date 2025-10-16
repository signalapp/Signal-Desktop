// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { reportMessage, isOnline } from '../textsecure/WebAPI.preload.js';
import { drop } from '../util/drop.std.js';
import { CallLinkFinalizeDeleteManager } from './CallLinkFinalizeDeleteManager.preload.js';
import { chatFolderCleanupService } from '../services/expiring/chatFolderCleanupService.preload.js';
import { callLinkRefreshJobQueue } from './callLinkRefreshJobQueue.preload.js';
import { conversationJobQueue } from './conversationJobQueue.preload.js';
import { deleteDownloadsJobQueue } from './deleteDownloadsJobQueue.preload.js';
import { groupAvatarJobQueue } from './groupAvatarJobQueue.preload.js';
import { readSyncJobQueue } from './readSyncJobQueue.preload.js';
import { removeStorageKeyJobQueue } from './removeStorageKeyJobQueue.preload.js';
import { reportSpamJobQueue } from './reportSpamJobQueue.preload.js';
import { singleProtoJobQueue } from './singleProtoJobQueue.preload.js';
import { viewOnceOpenJobQueue } from './viewOnceOpenJobQueue.preload.js';
import { viewSyncJobQueue } from './viewSyncJobQueue.preload.js';

type ServerType = {
  reportMessage: typeof reportMessage;
  isOnline: typeof isOnline;
};

/**
 * Start all of the job queues. Should be called when the database is ready.
 */
export function initializeAllJobQueues({
  server,
}: {
  server: ServerType;
}): void {
  reportSpamJobQueue.initialize({ server });

  // General conversation send queue
  drop(conversationJobQueue.streamJobs());

  // Group avatar download after backup import
  drop(groupAvatarJobQueue.streamJobs());

  // Single proto send queue, used for a variety of one-off simple messages
  drop(singleProtoJobQueue.streamJobs());

  // Syncs to ourselves
  drop(readSyncJobQueue.streamJobs());
  drop(viewSyncJobQueue.streamJobs());
  drop(viewOnceOpenJobQueue.streamJobs());

  // Other queues
  drop(deleteDownloadsJobQueue.streamJobs());
  drop(removeStorageKeyJobQueue.streamJobs());
  drop(reportSpamJobQueue.streamJobs());
  drop(callLinkRefreshJobQueue.streamJobs());
  drop(CallLinkFinalizeDeleteManager.start());
  drop(chatFolderCleanupService.start('initializeAllJobQueues'));
}

export async function shutdownAllJobQueues(): Promise<void> {
  await Promise.allSettled([
    callLinkRefreshJobQueue.shutdown(),
    conversationJobQueue.shutdown(),
    groupAvatarJobQueue.shutdown(),
    singleProtoJobQueue.shutdown(),
    readSyncJobQueue.shutdown(),
    viewSyncJobQueue.shutdown(),
    viewOnceOpenJobQueue.shutdown(),
    removeStorageKeyJobQueue.shutdown(),
    reportSpamJobQueue.shutdown(),
    CallLinkFinalizeDeleteManager.stop(),
    chatFolderCleanupService.stop('shutdownAllJobQueues'),
  ]);
}
