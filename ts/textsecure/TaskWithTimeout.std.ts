// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { MINUTE } from '../util/durations/index.std.js';
import { explodePromise } from '../util/explodePromise.std.js';
import { missingCaseError } from '../util/missingCaseError.std.js';
import { createLogger } from '../logging/log.std.js';

const TICK_INTERVAL = MINUTE / 2;

const log = createLogger('TaskWithTimeout');

type TaskType = {
  id: string;
  ticks: number;
  maxTicks: number;
  reject: (error: Error) => void;
};

const tasks = new Set<TaskType>();
let shouldStartTicking = true;

let tickInterval: NodeJS.Timeout | undefined;

function maybeStartTicking(): void {
  if (!shouldStartTicking) {
    return;
  }

  // Already ticking
  if (tickInterval != null) {
    return;
  }

  tickInterval = setInterval(() => {
    for (const task of tasks) {
      task.ticks += 1;
      if (task.ticks < task.maxTicks) {
        continue;
      }

      tasks.delete(task);
      task.reject(new Error(`TaskWithTimeout(${task.id}) timed out`));
    }
  }, TICK_INTERVAL);
}

export function suspendTasksWithTimeout(): void {
  if (!shouldStartTicking) {
    return;
  }
  log.info(`suspending ${tasks.size} tasks`);
  shouldStartTicking = false;
  if (tickInterval != null) {
    clearInterval(tickInterval);
    tickInterval = undefined;
  }
}

export function resumeTasksWithTimeout(): void {
  if (shouldStartTicking) {
    return;
  }
  log.info(`resuming ${tasks.size} tasks`);
  shouldStartTicking = true;
  maybeStartTicking();
}

export function reportLongRunningTasks(): void {
  for (const task of tasks) {
    const duration = task.ticks * TICK_INTERVAL;
    if (duration > MINUTE) {
      log.warn(`${task.id} has been running for ~${duration}ms`);
    }
  }
}

export async function runTaskWithTimeout<T>(
  task: () => Promise<T>,
  id: string,
  taskType: 'long-running' | 'short-lived' = 'long-running'
): Promise<T> {
  let maxTicks: number;

  if (taskType === 'long-running') {
    maxTicks = (30 * MINUTE) / TICK_INTERVAL;
  } else if (taskType === 'short-lived') {
    maxTicks = (2 * MINUTE) / TICK_INTERVAL;
  } else {
    throw missingCaseError(taskType);
  }

  const { promise: timerPromise, reject } = explodePromise<never>();

  const entry: TaskType = {
    id,
    ticks: 0,
    maxTicks,
    reject,
  };

  tasks.add(entry);
  maybeStartTicking();

  try {
    return await Promise.race([task(), timerPromise]);
  } finally {
    tasks.delete(entry);
    if (tasks.size === 0 && tickInterval != null) {
      clearInterval(tickInterval);
      tickInterval = undefined;
    }
  }
}
