// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { app, clipboard, crashReporter, ipcMain as ipc } from 'electron';
import { realpath, readdir, readFile, unlink } from 'fs-extra';
import { basename, join } from 'path';

import type { LoggerType } from '../ts/types/Logging';
import * as Errors from '../ts/types/errors';
import { isProduction } from '../ts/util/version';
import { upload as uploadDebugLog } from '../ts/logging/uploadDebugLog';
import { SignalService as Proto } from '../ts/protobuf';
import * as OS from '../ts/OS';

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

export async function setup(getLogger: () => LoggerType): Promise<void> {
  const isEnabled = !isProduction(app.getVersion());

  if (isEnabled) {
    getLogger().info('crashReporter: enabled');
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

  ipc.handle('crash-reports:upload', async () => {
    if (!isEnabled) {
      return;
    }

    const pendingDumps = await getPendingDumps();
    if (pendingDumps.length === 0) {
      return;
    }

    const logger = getLogger();
    logger.warn(`crashReports: uploading ${pendingDumps.length} dumps`);

    const maybeDumps = await Promise.all(
      pendingDumps.map(async fullPath => {
        try {
          return {
            filename: basename(fullPath),
            content: await readFile(fullPath),
          };
        } catch (error) {
          logger.warn(
            `crashReports: failed to read crash report ${fullPath} due to error`,
            Errors.toLogFormat(error)
          );
          return undefined;
        }
      })
    );

    const content = Proto.CrashReportList.encode({
      reports: maybeDumps.filter(
        (dump): dump is { filename: string; content: Buffer } => {
          return dump !== undefined;
        }
      ),
    }).finish();

    try {
      const url = await uploadDebugLog({
        content,
        appVersion: app.getVersion(),
        logger,
        extension: 'dmp',
        contentType: 'application/octet-stream',
        compress: false,
        prefix: 'desktop-crash-',
      });

      logger.info('crashReports: upload complete');
      clipboard.writeText(url);
    } finally {
      await eraseDumps(logger, pendingDumps);
    }
  });

  ipc.handle('crash-reports:erase', async () => {
    if (!isEnabled) {
      return;
    }

    const pendingDumps = await getPendingDumps();

    await eraseDumps(getLogger(), pendingDumps);
  });
}
