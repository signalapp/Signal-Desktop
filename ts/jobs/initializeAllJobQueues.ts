// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { WebAPIType } from '../textsecure/WebAPI';

import { normalMessageSendJobQueue } from './normalMessageSendJobQueue';
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

  normalMessageSendJobQueue.streamJobs();
  readSyncJobQueue.streamJobs();
  removeStorageKeyJobQueue.streamJobs();
  reportSpamJobQueue.streamJobs();
  viewSyncJobQueue.streamJobs();
  viewedReceiptsJobQueue.streamJobs();
}
