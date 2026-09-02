// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { reportMessage, isOnline } from '../textsecure/WebAPI.preload.ts';
import { drop } from '../util/drop.std.ts';
import { conversationJobQueue } from './conversationJobQueue.preload.ts';
import { groupAvatarJobQueue } from './groupAvatarJobQueue.preload.ts';
import { singleProtoJobQueue } from './singleProtoJobQueue.preload.ts';
import { readSyncJobQueue } from './readSyncJobQueue.preload.ts';
import { viewSyncJobQueue } from './viewSyncJobQueue.preload.ts';
import { viewOnceOpenJobQueue } from './viewOnceOpenJobQueue.preload.ts';
import { deleteDownloadsJobQueue } from './deleteDownloadsJobQueue.preload.ts';
import { registrationJobQueue } from './registrationJobQueue.preload.ts';
import { removeStorageKeyJobQueue } from './removeStorageKeyJobQueue.preload.ts';
import { reportSpamJobQueue } from './reportSpamJobQueue.preload.ts';
import { callLinkRefreshJobQueue } from './callLinkRefreshJobQueue.preload.ts';
import { callLinkCleanupService } from '../services/expiring/callLinkCleanupService.preload.ts';
import { defunctCallLinkCleanupService } from '../services/expiring/defunctCallLinkCleanupService.preload.ts';
import { chatFolderCleanupService } from '../services/expiring/chatFolderCleanupService.preload.ts';
import { pinnedMessagesCleanupService } from '../services/expiring/pinnedMessagesCleanupService.preload.ts';

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
  drop(registrationJobQueue.streamJobs());
  drop(removeStorageKeyJobQueue.streamJobs());
  drop(reportSpamJobQueue.streamJobs());
  drop(callLinkRefreshJobQueue.streamJobs());
  drop(callLinkCleanupService.start('initializeAllJobQueues'));
  drop(defunctCallLinkCleanupService.start('initializeAllJobQueues'));
  drop(chatFolderCleanupService.start('initializeAllJobQueues'));
  drop(pinnedMessagesCleanupService.start('initializeAllJobQueues'));
}

export async function shutdownAllJobQueues(): Promise<void> {
  await Promise.allSettled([
    conversationJobQueue.shutdown(),
    groupAvatarJobQueue.shutdown(),
    singleProtoJobQueue.shutdown(),
    readSyncJobQueue.shutdown(),
    viewSyncJobQueue.shutdown(),
    viewOnceOpenJobQueue.shutdown(),
    deleteDownloadsJobQueue.shutdown(),
    registrationJobQueue.shutdown(),
    removeStorageKeyJobQueue.shutdown(),
    reportSpamJobQueue.shutdown(),
    callLinkRefreshJobQueue.shutdown(),
    callLinkCleanupService.stop('shutdownAllJobQueues'),
    defunctCallLinkCleanupService.stop('shutdownAllJobQueues'),
    chatFolderCleanupService.stop('shutdownAllJobQueues'),
    pinnedMessagesCleanupService.stop('shutdownAllJobQueues'),
  ]);
}
