// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import fs from 'node:fs';
import pino from 'pino';

import { DAY, SECOND } from './durations/index.std.js';
import { isMoreRecentThan } from './timestamp.std.js';

export const DEFAULT_MAX_ROTATIONS = 3;

const RETRY_DELAY = 5 * SECOND;

// 5 seconds * 12 = 1 minute
const MAX_RETRY_COUNT = 12;

export type RotatingPinoDestOptionsType = Readonly<{
  logFile: string;
  maxSavedLogFiles?: number;
  interval?: number;
}>;

export function createRotatingPinoDest({
  logFile,
  maxSavedLogFiles = DEFAULT_MAX_ROTATIONS,
  interval = DAY,
}: RotatingPinoDestOptionsType): ReturnType<typeof pino.destination> {
  const boom = pino.destination({
    dest: logFile,
    sync: true,
    mkdir: true,
  });

  let retryCount = 0;

  const warn = (msg: string) => {
    const line = JSON.stringify({
      level: 40,
      time: new Date(),
      msg,
    });
    boom.write(`${line}\n`);
  };

  function maybeRotate(startingIndex = maxSavedLogFiles - 1) {
    let pendingFileIndex = startingIndex;
    try {
      const { birthtimeMs } = fs.statSync(logFile);

      if (isMoreRecentThan(birthtimeMs, interval)) {
        return;
      }

      for (; pendingFileIndex >= 0; pendingFileIndex -= 1) {
        const currentPath =
          pendingFileIndex === 0 ? logFile : `${logFile}.${pendingFileIndex}`;
        const nextPath = `${logFile}.${pendingFileIndex + 1}`;

        if (fs.existsSync(nextPath)) {
          fs.unlinkSync(nextPath);
        }
        if (!fs.existsSync(currentPath)) {
          continue;
        }
        fs.renameSync(currentPath, nextPath);
      }
    } catch (error) {
      // If we can't access the old log files - try rotating after a small
      // delay.
      if (
        retryCount < MAX_RETRY_COUNT &&
        (error.code === 'EACCES' || error.code === 'EPERM')
      ) {
        retryCount += 1;
        warn(`rotatingPinoDest: retrying rotation, retryCount=${retryCount}`);
        setTimeout(() => maybeRotate(pendingFileIndex), RETRY_DELAY);
        return;
      }

      boom.destroy();
      boom.emit('error', error);
      return;
    }

    // Success, reopen
    boom.reopen();

    if (retryCount !== 0) {
      warn(`rotatingPinoDest: rotation succeeded after ${retryCount} retries`);
    }

    retryCount = 0;
  }

  maybeRotate();
  setInterval(maybeRotate, interval);

  return boom;
}
