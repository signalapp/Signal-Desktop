// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';

import type { JOB_STATUS } from './JobQueue';
import { JobQueue } from './JobQueue';

import { jobQueueDatabaseStore } from './JobQueueDatabaseStore';
import { parseUnknown } from '../util/schemas';

const removeStorageKeyJobDataSchema = z.object({
  key: z.enum([
    'challenge:retry-message-ids',
    'previousAudioDeviceModule',
    'nextSignedKeyRotationTime',
    'senderCertificateWithUuid',
    'signedKeyRotationRejected',
  ]),
});

type RemoveStorageKeyJobData = z.infer<typeof removeStorageKeyJobDataSchema>;

export class RemoveStorageKeyJobQueue extends JobQueue<RemoveStorageKeyJobData> {
  protected parseData(data: unknown): RemoveStorageKeyJobData {
    return parseUnknown(removeStorageKeyJobDataSchema, data);
  }

  protected async run({
    data,
  }: Readonly<{ data: RemoveStorageKeyJobData }>): Promise<
    typeof JOB_STATUS.NEEDS_RETRY | undefined
  > {
    await new Promise<void>(resolve => {
      window.storage.onready(resolve);
    });

    await window.storage.remove(data.key);

    return undefined;
  }
}

export const removeStorageKeyJobQueue = new RemoveStorageKeyJobQueue({
  store: jobQueueDatabaseStore,
  queueType: 'remove storage key',
  maxAttempts: 100,
});
