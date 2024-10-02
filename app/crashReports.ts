// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { app, crashReporter, ipcMain as ipc } from 'electron';
import { realpath, readdir, readFile, unlink, stat } from 'fs-extra';
import { basename, join } from 'path';
import { toJSONString as dumpToJSONString } from '@signalapp/libsignal-client/dist/Minidump';
import z from 'zod';

import type { LoggerType } from '../ts/types/Logging';
import * as Errors from '../ts/types/errors';
import { isProduction } from '../ts/util/version';
import { isNotNil } from '../ts/util/isNotNil';
import OS from '../ts/util/os/osMain';
import { parseUnknown } from '../ts/util/schemas';

// See https://github.com/rust-minidump/rust-minidump/blob/main/minidump-processor/json-schema.md
const dumpString = z.string().or(z.null()).optional();
const dumpNumber = z.number().or(z.null()).optional();

const threadSchema = z.object({
  thread_name: dumpString,
  frames: z
    .object({
      offset: dumpString,
      module: dumpString,
      module_offset: dumpString,
    })
    .array()
    .or(z.null())
    .optional(),
});

const dumpSchema = z.object({
  crash_info: z
    .object({
      type: dumpString,
      crashing_thread: dumpNumber,
      address: dumpString,
    })
    .optional()
    .or(z.null()),
  crashing_thread: threadSchema.or(z.null()).optional(),
  threads: threadSchema.array().or(z.null()).optional(),
  modules: z
    .object({
      filename: dumpString,
      debug_file: dumpString,
      debug_id: dumpString,
      base_addr: dumpString,
      end_addr: dumpString,
      version: dumpString,
    })
    .array()
    .or(z.null())
    .optional(),
  system_info: z
    .object({
      cpu_arch: dumpString,
      os: dumpString,
      os_ver: dumpString,
    })
    .or(z.null())
    .optional(),
});

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
  const isEnabled = !isProduction(app.getVersion()) || forceEnable;

  if (isEnabled) {
    getLogger().info(`crashReporter: ${forceEnable ? 'force ' : ''}enabled`);
    crashReporter.start({ uploadToServer: false });
  }

  ipc.handle('crash-reports:get-count', async () => {
    if (!isEnabled) {
      return 0;
    }

    const pendingDumps = await getPendingDumps();
    const filteredDumps = (
      await Promise.all(
        pendingDumps.map(async fullPath => {
          const content = await readFile(fullPath);
          try {
            const json: unknown = JSON.parse(dumpToJSONString(content));
            const dump = parseUnknown(dumpSchema, json);
            if (dump.crash_info?.type !== 'Simulated Exception') {
              return fullPath;
            }
          } catch (error) {
            getLogger().error(
              `crashReports: failed to read crash report ${fullPath} due to error`,
              Errors.toLogFormat(error)
            );
          }

          try {
            await unlink(fullPath);
          } catch (error) {
            getLogger().error(
              `crashReports: failed to unlink crash report ${fullPath}`,
              Errors.toLogFormat(error)
            );
          }
          return undefined;
        })
      )
    ).filter(isNotNil);

    if (filteredDumps.length !== 0) {
      getLogger().warn(
        `crashReports: ${filteredDumps.length} pending dumps found`
      );
    }
    return filteredDumps.length;
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

          const json: unknown = JSON.parse(dumpToJSONString(content));
          const dump = parseUnknown(dumpSchema, json);

          if (dump.crash_info?.type === 'Simulated Exception') {
            return undefined;
          }

          dump.modules = dump.modules?.filter(({ filename }) => {
            if (filename == null) {
              return false;
            }

            // Node.js Addons are useful
            if (/\.node$/.test(filename)) {
              return true;
            }

            // So is Electron
            if (/electron|signal/i.test(filename)) {
              return true;
            }

            // Rest are not relevant
            return false;
          });

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
