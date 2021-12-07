// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { WebAPIType } from '../textsecure/WebAPI';

import { deliveryReceiptsJobQueue } from './deliveryReceiptsJobQueue';
import { normalMessageSendJobQueue } from './normalMessageSendJobQueue';
import { reactionJobQueue } from './reactionJobQueue';
import { readReceiptsJobQueue } from './readReceiptsJobQueue';
import { readSyncJobQueue } from './readSyncJobQueue';
import { removeStorageKeyJobQueue } from './removeStorageKeyJobQueue';
import { reportSpamJobQueue } from './reportSpamJobQueue';
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

  deliveryReceiptsJobQueue.streamJobs();
  normalMessageSendJobQueue.streamJobs();
  reactionJobQueue.streamJobs();
  readReceiptsJobQueue.streamJobs();
  readSyncJobQueue.streamJobs();
  removeStorageKeyJobQueue.streamJobs();
  reportSpamJobQueue.streamJobs();
  viewSyncJobQueue.streamJobs();
  viewedReceiptsJobQueue.streamJobs();
}
