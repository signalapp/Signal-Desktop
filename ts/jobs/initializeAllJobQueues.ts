// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { WebAPIType } from '../textsecure/WebAPI.js';
import { drop } from '../util/drop.js';
import { CallLinkFinalizeDeleteManager } from './CallLinkFinalizeDeleteManager.js';
import { chatFolderCleanupService } from '../services/expiring/chatFolderCleanupService.js';
import { callLinkRefreshJobQueue } from './callLinkRefreshJobQueue.js';
import { conversationJobQueue } from './conversationJobQueue.js';
import { deleteDownloadsJobQueue } from './deleteDownloadsJobQueue.js';
import { groupAvatarJobQueue } from './groupAvatarJobQueue.js';
import { readSyncJobQueue } from './readSyncJobQueue.js';
import { removeStorageKeyJobQueue } from './removeStorageKeyJobQueue.js';
import { reportSpamJobQueue } from './reportSpamJobQueue.js';
import { singleProtoJobQueue } from './singleProtoJobQueue.js';
import { viewOnceOpenJobQueue } from './viewOnceOpenJobQueue.js';
import { viewSyncJobQueue } from './viewSyncJobQueue.js';

/**
 * Start all of the job queues. Should be called when the database is ready.
 */
export function initializeAllJobQueues({
  server,
}: {
  server: WebAPIType;
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
