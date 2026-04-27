// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import PQueue from 'p-queue';
import { runTaskWithTimeout } from '../textsecure/TaskWithTimeout.std.ts';

function createJobQueue(label: string) {
  const jobQueue = new PQueue({ concurrency: 1 });

  return (job: () => Promise<void>, id = '') => {
    return jobQueue.add(() => runTaskWithTimeout(job, `${label} ${id}`));
  };
}

export const storageJobQueue = createJobQueue('storageService');
