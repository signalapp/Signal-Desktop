// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { app, crashReporter, ipcMain as ipc } from 'electron';
import { realpath, readdir, readFile, unlink, stat } from 'fs-extra';
import { basename, join } from 'path';
import { toJSONString as dumpToJSONString } from '@signalapp/libsignal-client/dist/Minidump';
import z from 'zod';

import type { LoggerType } from '../ts/types/Logging';
import * as Errors from '../ts/types/errors';
import { isAlpha } from '../ts/util/version';
import OS from '../ts/util/os/osMain';

const dumpSchema = z
  .object({
    crashing_thread: z
      .object({
        frames: z
          .object({
            registers: z.unknown(),
          })
          .passthrough()
          .array()
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

async function getPendingDumps(): Promise<ReadonlyArray<string>> {
  const crashDumpsPath = await realpath(app.getPath('crashDumps'));
  let pendingDir: string;
  if (OS.isWindows()) {
    pendingDir = join(crashDumpsPath, 'reports');
  } else {
    // macOS and Linux
    pendingDir = join(crashDumpsPath, 'pending');
  }

  const files = await readdir(pendingDir);

  return files.map(file => join(pendingDir, file));
}

async function eraseDumps(
  logger: LoggerType,
  files: ReadonlyArray<string>
): Promise<void> {
  logger.warn(`crashReports: erasing ${files.length} pending dumps`);
  await Promise.all(
    files.map(async fullPath => {
      try {
        await unlink(fullPath);
      } catch (error) {
        logger.warn(
          `crashReports: failed to unlink crash report ${fullPath} due to error`,
          Errors.toLogFormat(error)
        );
      }
    })
  );
}

export function setup(
  getLogger: () => LoggerType,
  showDebugLogWindow: () => Promise<void>,
  forceEnable = false
): void {
  const isEnabled = isAlpha(app.getVersion()) || forceEnable;

  if (isEnabled) {
    getLogger().info(`crashReporter: ${forceEnable ? 'force ' : ''}enabled`);
    crashReporter.start({ uploadToServer: false });
  }

  ipc.handle('crash-reports:get-count', async () => {
    if (!isEnabled) {
      return 0;
    }

    const pendingDumps = await getPendingDumps();
    if (pendingDumps.length !== 0) {
      getLogger().warn(
        `crashReports: ${pendingDumps.length} pending dumps found`
      );
    }
    return pendingDumps.length;
  });

  ipc.handle('crash-reports:write-to-log', async () => {
    if (!isEnabled) {
      return;
    }

    const pendingDumps = await getPendingDumps();
    if (pendingDumps.length === 0) {
      return;
    }

    const logger = getLogger();
    logger.warn(`crashReports: logging ${pendingDumps.length} dumps`);

    await Promise.all(
      pendingDumps.map(async fullPath => {
        try {
          const content = await readFile(fullPath);
          const { mtime } = await stat(fullPath);

          const dump = dumpSchema.parse(JSON.parse(dumpToJSONString(content)));
          for (const frame of dump.crashing_thread?.frames ?? []) {
            delete frame.registers;
          }

          logger.warn(
            `crashReports: dump=${basename(fullPath)} ` +
              `mtime=${JSON.stringify(mtime)}`,
            JSON.stringify(dump, null, 2)
          );
        } catch (error) {
          logger.error(
            `crashReports: failed to read crash report ${fullPath} due to error`,
            Errors.toLogFormat(error)
          );
          return undefined;
        }
      })
    );

    await eraseDumps(logger, pendingDumps);
    await showDebugLogWindow();
  });

  ipc.handle('crash-reports:erase', async () => {
    if (!isEnabled) {
      return;
    }

    const pendingDumps = await getPendingDumps();

    await eraseDumps(getLogger(), pendingDumps);
  });
}
