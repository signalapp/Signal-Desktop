// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { removeStorageKeyJobQueue } from './removeStorageKeyJobQueue';

/**
 * Start all of the job queues. Should be called when the database is ready.
 */
export function initializeAllJobQueues(): void {
  removeStorageKeyJobQueue.streamJobs();
}
