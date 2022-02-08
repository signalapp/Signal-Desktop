// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { WebAPIType } from '../textsecure/WebAPI';

import { deliveryReceiptsJobQueue } from './deliveryReceiptsJobQueue';
import { normalMessageSendJobQueue } from './normalMessageSendJobQueue';
import { reactionJobQueue } from './reactionJobQueue';
import { readReceiptsJobQueue } from './readReceiptsJobQueue';
import { readSyncJobQueue } from './readSyncJobQueue';
import { removeStorageKeyJobQueue } from './removeStorageKeyJobQueue';
import { reportSpamJobQueue } from './reportSpamJobQueue';
import { singleProtoJobQueue } from './singleProtoJobQueue';
import { viewOnceOpenJobQueue } from './viewOnceOpenJobQueue';
import { viewSyncJobQueue } from './viewSyncJobQueue';
import { viewedReceiptsJobQueue } from './viewedReceiptsJobQueue';

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
  normalMessageSendJobQueue.streamJobs();
  reactionJobQueue.streamJobs();

  // Single proto send queue, used for a variety of one-off simple messages
  singleProtoJobQueue.streamJobs();

  // Syncs to others
  deliveryReceiptsJobQueue.streamJobs();
  readReceiptsJobQueue.streamJobs();
  viewedReceiptsJobQueue.streamJobs();
  viewOnceOpenJobQueue.streamJobs();

  // Syncs to ourselves
  readSyncJobQueue.streamJobs();
  viewSyncJobQueue.streamJobs();

  // Other queues
  removeStorageKeyJobQueue.streamJobs();
  reportSpamJobQueue.streamJobs();
}
