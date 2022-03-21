// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';

import { JobQueue } from './JobQueue';
import { jobQueueDatabaseStore } from './JobQueueDatabaseStore';

const removeStorageKeyJobDataSchema = z.object({
  key: z.enum(['senderCertificateWithUuid', 'challenge:retry-message-ids']),
});

type RemoveStorageKeyJobData = z.infer<typeof removeStorageKeyJobDataSchema>;

export class RemoveStorageKeyJobQueue extends JobQueue<RemoveStorageKeyJobData> {
  protected parseData(data: unknown): RemoveStorageKeyJobData {
    return removeStorageKeyJobDataSchema.parse(data);
  }

  protected async run({
    data,
  }: Readonly<{ data: RemoveStorageKeyJobData }>): Promise<void> {
    await new Promise<void>(resolve => {
      window.storage.onready(resolve);
    });

    await window.storage.remove(data.key);
  }
}

export const removeStorageKeyJobQueue = new RemoveStorageKeyJobQueue({
  store: jobQueueDatabaseStore,
  queueType: 'remove storage key',
  maxAttempts: 100,
});
