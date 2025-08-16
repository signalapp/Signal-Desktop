// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { WebAPIType } from '../textsecure/WebAPI';
import { drop } from '../util/drop';
import { CallLinkFinalizeDeleteManager } from './CallLinkFinalizeDeleteManager';

import { callLinkRefreshJobQueue } from './callLinkRefreshJobQueue';
import { conversationJobQueue } from './conversationJobQueue';
import { deleteDownloadsJobQueue } from './deleteDownloadsJobQueue';
import { groupAvatarJobQueue } from './groupAvatarJobQueue';
import { readSyncJobQueue } from './readSyncJobQueue';
import { removeStorageKeyJobQueue } from './removeStorageKeyJobQueue';
import { reportSpamJobQueue } from './reportSpamJobQueue';
import { singleProtoJobQueue } from './singleProtoJobQueue';
import { viewOnceOpenJobQueue } from './viewOnceOpenJobQueue';
import { viewSyncJobQueue } from './viewSyncJobQueue';

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
  ]);
}
