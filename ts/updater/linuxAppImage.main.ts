// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { copyFile, unlink } from 'node:fs/promises';
import { chmod } from 'fs-extra';

import config from 'config';
import { app } from 'electron';
import { coerce, lt } from 'semver';

import type { JSONVendorSchema } from './common.main.js';
import { Updater } from './common.main.js';
import { appRelaunch } from '../util/relaunch.main.js';
import { hexToBinary } from './signature.node.js';
import { DialogType } from '../types/Dialogs.std.js';

export class LinuxAppImageUpdater extends Updater {
  #installing = false;

  protected async deletePreviousInstallers(): Promise<void> {
    // No installers are cached beyond the most recent one
  }

  protected async installUpdate(
    updateFilePath: string
  ): Promise<() => Promise<void>> {
    const { logger } = this;

    return async () => {
      logger.info('downloadAndInstall: installing...');
      try {
        await this.#install(updateFilePath);
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
    appRelaunch();
    app.quit();
  }

  override getUpdatesPublicKey(): Buffer<ArrayBuffer> {
    return hexToBinary(config.get('appImageUpdatesPublicKey'));
  }

  async #install(updateFilePath: string): Promise<void> {
    if (this.#installing) {
      return;
    }

    const { logger } = this;

    logger.info('linuxAppImage/install: installing package...');

    const appImageFile = process.env.APPIMAGE;
    if (appImageFile == null) {
      throw new Error('APPIMAGE env is not defined!');
    }

    // https://stackoverflow.com/a/1712051/1910191
    await unlink(appImageFile);
    await copyFile(updateFilePath, appImageFile);
    await chmod(appImageFile, 0o700);
  }

  override checkSystemRequirements(vendor: JSONVendorSchema): boolean {
    const { minGlibcVersion } = vendor;
    if (minGlibcVersion) {
      const parsedMinGlibcVersion = coerce(minGlibcVersion);
      if (!parsedMinGlibcVersion) {
        this.logger.warn(
          'checkSystemRequirements: yaml had unparseable minGlibcVersion, ignoring. ' +
            `yaml value: ${minGlibcVersion}`
        );
        return true;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sysReport = process.report.getReport() as any;
      const glibcVersion = sysReport?.header?.glibcVersionRuntime;
      const parsedGlibcVersion = glibcVersion ? coerce(glibcVersion) : null;
      if (!parsedGlibcVersion) {
        this.logger.warn(
          'checkSystemRequirements: yaml had minGlibcVersion but unable to' +
            'get OS glibc version from system report, blocking update. ' +
            `system value: ${glibcVersion}`
        );
        this.markCannotUpdate(
          new Error('system glibc version missing or unparseable'),
          DialogType.UnsupportedOS
        );
        return false;
      }

      if (lt(parsedGlibcVersion, parsedMinGlibcVersion)) {
        this.logger.warn(
          `checkSystemRequirements: OS glibc ${glibcVersion} is less than the ` +
            `minimum supported version ${minGlibcVersion}`
        );
        this.markCannotUpdate(
          new Error('yaml file has unsatisfied minGlibcVersion value'),
          DialogType.UnsupportedOS
        );
        return false;
      }
    }

    return true;
  }
}
