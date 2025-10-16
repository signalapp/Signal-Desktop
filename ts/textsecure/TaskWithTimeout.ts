// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { MINUTE } from '../util/durations/index.std.js';
import { clearTimeoutIfNecessary } from '../util/clearTimeoutIfNecessary.std.js';
import { explodePromise } from '../util/explodePromise.std.js';
import { toLogFormat } from '../types/errors.std.js';
import { createLogger } from '../logging/log.std.js';

const log = createLogger('TaskWithTimeout');

type TaskType = {
  id: string;
  startedAt: number | undefined;
  suspend(): void;
  resume(): void;
};

const tasks = new Set<TaskType>();
let shouldStartTimers = true;

export function suspendTasksWithTimeout(): void {
  log.info(`suspending ${tasks.size} tasks`);
  shouldStartTimers = false;
  for (const task of tasks) {
    task.suspend();
  }
}

export function resumeTasksWithTimeout(): void {
  log.info(`resuming ${tasks.size} tasks`);
  shouldStartTimers = true;
  for (const task of tasks) {
    task.resume();
  }
}

export function reportLongRunningTasks(): void {
  const now = Date.now();
  for (const task of tasks) {
    if (task.startedAt === undefined) {
      continue;
    }

    const duration = Math.max(0, now - task.startedAt);
    if (duration > MINUTE) {
      log.warn(`${task.id} has been running for ${duration}ms`);
    }
  }
}

export default function createTaskWithTimeout<T, Args extends Array<unknown>>(
  task: (...args: Args) => Promise<T>,
  id: string,
  options: { timeout?: number } = {}
): (...args: Args) => Promise<T> {
  const timeout = options.timeout || 30 * MINUTE;

  const timeoutError = new Error(`${id || ''} task did not complete in time.`);

  return async (...args: Args) => {
    let complete = false;

    let timer: NodeJS.Timeout | undefined;

    const { promise: timerPromise, reject } = explodePromise<never>();

    const startTimer = () => {
      stopTimer();

      if (complete) {
        return;
      }

      entry.startedAt = Date.now();
      timer = setTimeout(() => {
        if (complete) {
          log.warn(`${id} task timed out, but was already complete`);
          return;
        }
        complete = true;
        tasks.delete(entry);

        log.error(toLogFormat(timeoutError));
        reject(timeoutError);
      }, timeout);
    };

    const stopTimer = () => {
      clearTimeoutIfNecessary(timer);
      timer = undefined;
    };

    const entry: TaskType = {
      id,
      startedAt: undefined,
      suspend: () => {
        log.warn(`${id} task suspended`);
        stopTimer();
      },
      resume: () => {
        log.warn(`${id} task resumed`);
        startTimer();
      },
    };

    tasks.add(entry);
    if (shouldStartTimers) {
      startTimer();
    }

    let result: unknown;

    const run = async (): Promise<void> => {
      result = await task(...args);
    };

    try {
      await Promise.race([run(), timerPromise]);

      return result as T;
    } finally {
      complete = true;
      tasks.delete(entry);
      stopTimer();
    }
  };
}
