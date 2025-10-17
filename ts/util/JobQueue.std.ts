// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import PQueue from 'p-queue';
import createTaskWithTimeout from '../textsecure/TaskWithTimeout.std.js';

function createJobQueue(label: string) {
  const jobQueue = new PQueue({ concurrency: 1 });

  return (job: () => Promise<void>, id = '') => {
    const taskWithTimeout = createTaskWithTimeout(job, `${label} ${id}`);

    return jobQueue.add(taskWithTimeout);
  };
}

export const storageJobQueue = createJobQueue('storageService');
