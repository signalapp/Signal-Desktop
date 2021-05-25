// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';

import { JobQueue } from './JobQueue';
import { jobQueueDatabaseStore } from './JobQueueDatabaseStore';

const removeStorageKeyJobDataSchema = z.object({
  key: z.string().min(1),
});

type RemoveStorageKeyJobData = z.infer<typeof removeStorageKeyJobDataSchema>;

export const removeStorageKeyJobQueue = new JobQueue<RemoveStorageKeyJobData>({
  store: jobQueueDatabaseStore,

  queueType: 'remove storage key',

  maxAttempts: 100,

  parseData(data: unknown): RemoveStorageKeyJobData {
    return removeStorageKeyJobDataSchema.parse(data);
  },

  async run({
    data,
  }: Readonly<{ data: RemoveStorageKeyJobData }>): Promise<void> {
    await new Promise<void>(resolve => {
      window.storage.onready(resolve);
    });

    await window.storage.remove(data.key);
  },
});
