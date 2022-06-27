// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as durations from '../util/durations';
import { clearTimeoutIfNecessary } from '../util/clearTimeoutIfNecessary';
import { explodePromise } from '../util/explodePromise';
import { toLogFormat } from '../types/errors';
import * as log from '../logging/log';

type TaskType = {
  suspend(): void;
  resume(): void;
};

const tasks = new Set<TaskType>();
let shouldStartTimers = true;

export function suspendTasksWithTimeout(): void {
  log.info(`TaskWithTimeout: suspending ${tasks.size} tasks`);
  shouldStartTimers = false;
  for (const task of tasks) {
    task.suspend();
  }
}

export function resumeTasksWithTimeout(): void {
  log.info(`TaskWithTimeout: resuming ${tasks.size} tasks`);
  shouldStartTimers = true;
  for (const task of tasks) {
    task.resume();
  }
}

export default function createTaskWithTimeout<T, Args extends Array<unknown>>(
  task: (...args: Args) => Promise<T>,
  id: string,
  options: { timeout?: number } = {}
): (...args: Args) => Promise<T> {
  const timeout = options.timeout || 30 * durations.MINUTE;

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

      timer = setTimeout(() => {
        if (complete) {
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
      suspend: stopTimer,
      resume: startTimer,
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
