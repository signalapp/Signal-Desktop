// Copyright 2017-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../ts/logging/log';
import {
  parseSystemTraySetting,
  SystemTraySetting,
} from '../ts/types/SystemTraySetting';
import { isSystemTraySupported } from '../ts/types/Settings';
import type { MainSQL } from '../ts/sql/main';

/**
 * A small helper class to get and cache the `system-tray-setting` preference in the main
 * process.
 */
export class SystemTraySettingCache {
  private cachedValue: undefined | SystemTraySetting;

  private getPromise: undefined | Promise<SystemTraySetting>;

  constructor(
    private readonly sql: Pick<MainSQL, 'sqlCall'>,
    private readonly argv: Array<string>,
    private readonly appVersion: string
  ) {}

  async get(): Promise<SystemTraySetting> {
    if (this.cachedValue !== undefined) {
      return this.cachedValue;
    }

    this.getPromise = this.getPromise || this.doFirstGet();
    return this.getPromise;
  }

  set(value: SystemTraySetting): void {
    this.cachedValue = value;
  }

  private async doFirstGet(): Promise<SystemTraySetting> {
    let result: SystemTraySetting;

    // These command line flags are not officially supported, but many users rely on them.
    //   Be careful when removing them or making changes.
    if (this.argv.some(arg => arg === '--start-in-tray')) {
      result = SystemTraySetting.MinimizeToAndStartInSystemTray;
      log.info(
        `getSystemTraySetting saw --start-in-tray flag. Returning ${result}`
      );
    } else if (this.argv.some(arg => arg === '--use-tray-icon')) {
      result = SystemTraySetting.MinimizeToSystemTray;
      log.info(
        `getSystemTraySetting saw --use-tray-icon flag. Returning ${result}`
      );
    } else if (isSystemTraySupported(this.appVersion)) {
      const { value } = (await this.sql.sqlCall('getItemById', [
        'system-tray-setting',
      ])) || { value: undefined };

      if (value !== undefined) {
        result = parseSystemTraySetting(value);
        log.info(
          `getSystemTraySetting returning value from database, ${result}`
        );
      } else {
        result = SystemTraySetting.DoNotUseSystemTray;
        log.info(
          `getSystemTraySetting got no value from database, returning ${result}`
        );
      }
    } else {
      result = SystemTraySetting.DoNotUseSystemTray;
      log.info(
        `getSystemTraySetting had no flags and did no DB lookups. Returning ${result}`
      );
    }

    // If there's a value in the cache, someone has updated the value "out from under us",
    //   so we should return that because it's newer.
    this.cachedValue =
      this.cachedValue === undefined ? result : this.cachedValue;

    return this.cachedValue;
  }
}
