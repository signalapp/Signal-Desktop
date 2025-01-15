// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'path';
import type { SpawnOptions } from 'child_process';
import { spawn as spawnEmitter } from 'child_process';
import { readdir as readdirCallback, unlink as unlinkCallback } from 'fs';

import { app } from 'electron';
import pify from 'pify';

import { Updater } from './common';

const readdir = pify(readdirCallback);
const unlink = pify(unlinkCallback);

const IS_EXE = /\.exe$/i;

export class WindowsUpdater extends Updater {
  #installing = false;

  // This is fixed by our new install mechanisms...
  //   https://github.com/signalapp/Signal-Desktop/issues/2369
  // ...but we should also clean up those old installers.
  protected async deletePreviousInstallers(): Promise<void> {
    const userDataPath = app.getPath('userData');
    const files: Array<string> = await readdir(userDataPath);
    await Promise.all(
      files.map(async file => {
        const isExe = IS_EXE.test(file);
        if (!isExe) {
          return;
        }

        const fullPath = join(userDataPath, file);
        try {
          await unlink(fullPath);
        } catch (error) {
          this.logger.error(
            `deletePreviousInstallers: couldn't delete file ${file}`
          );
        }
      })
    );
  }
  protected async installUpdate(
    updateFilePath: string,
    isSilent: boolean
  ): Promise<() => Promise<void>> {
    const { logger } = this;

    return async () => {
      logger.info('downloadAndInstall: installing...');
      try {
        await this.#install(updateFilePath, isSilent);
        this.#installing = true;
      } catch (error) {
        this.markCannotUpdate(error);

        throw error;
      }

      // If interrupted at this point, we only want to restart (not reattempt install)
      this.setUpdateListener(this.restart);
      this.restart();
    };
  }

  protected restart(): void {
    this.logger.info('downloadAndInstall: restarting...');
    this.markRestarting();
    app.quit();
  }

  async #install(filePath: string, isSilent: boolean): Promise<void> {
    if (this.#installing) {
      return;
    }

    const { logger } = this;

    logger.info('windows/install: installing package...');
    const args = ['--updated'];
    if (isSilent) {
      // App isn't automatically restarted with "/S" flag, but "--updated"
      // will trigger our code in `build/installer.nsh` that will start the app
      // with "--start-in-tray" flag (see `app/main.ts`)
      args.push('/S');
    }
    const options = {
      detached: true,
      stdio: 'ignore' as const, // TypeScript considers this a plain string without help
    };

    try {
      await spawn(filePath, args, options);
    } catch (error) {
      if (error.code === 'UNKNOWN' || error.code === 'EACCES') {
        logger.warn(
          'windows/install: Error running installer; Trying again with elevate.exe'
        );
        await spawn(getElevatePath(), [filePath, ...args], options);

        return;
      }

      throw error;
    }
  }
}

// Helpers

function getElevatePath() {
  const installPath = app.getAppPath();

  return join(installPath, 'resources', 'elevate.exe');
}

async function spawn(
  exe: string,
  args: Array<string>,
  options: SpawnOptions
): Promise<void> {
  return new Promise((resolve, reject) => {
    const emitter = spawnEmitter(exe, args, options);
    emitter.on('error', reject);
    emitter.unref();

    setTimeout(resolve, 200);
  });
}
