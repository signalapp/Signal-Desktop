// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import fs from 'fs';
import pino from 'pino';

import { DAY } from './durations';
import { isMoreRecentThan } from './timestamp';

export const DEFAULT_MAX_ROTATIONS = 3;

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

  function maybeRotate() {
    try {
      const { birthtimeMs } = fs.statSync(logFile);

      if (isMoreRecentThan(birthtimeMs, interval)) {
        return;
      }

      for (let i = maxSavedLogFiles - 1; i >= 0; i -= 1) {
        const currentPath = i === 0 ? logFile : `${logFile}.${i}`;
        const nextPath = `${logFile}.${i + 1}`;

        if (fs.existsSync(nextPath)) {
          fs.unlinkSync(nextPath);
        }
        if (!fs.existsSync(currentPath)) {
          continue;
        }
        fs.renameSync(currentPath, nextPath);
      }
    } catch (error) {
      boom.destroy();
      boom.emit('error', error);
    }

    boom.reopen();
  }

  maybeRotate();
  setInterval(maybeRotate, interval);

  return boom;
}
