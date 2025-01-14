// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../ts/logging/log';
import OS from '../ts/util/os/osMain';
import {
  parseSystemTraySetting,
  SystemTraySetting,
} from '../ts/types/SystemTraySetting';
import { isSystemTraySupported } from '../ts/types/Settings';
import type { ConfigType } from './base_config';

/**
 * A small helper class to get and cache the `system-tray-setting` preference in the main
 * process.
 */
export class SystemTraySettingCache {
  #cachedValue: undefined | SystemTraySetting;
  #getPromise: undefined | Promise<SystemTraySetting>;

  constructor(
    private readonly ephemeralConfig: Pick<ConfigType, 'get' | 'set'>,
    private readonly argv: Array<string>
  ) {}

  async get(): Promise<SystemTraySetting> {
    if (this.#cachedValue !== undefined) {
      return this.#cachedValue;
    }

    this.#getPromise = this.#getPromise || this.#doFirstGet();
    return this.#getPromise;
  }

  set(value: SystemTraySetting): void {
    this.#cachedValue = value;
  }

  async #doFirstGet(): Promise<SystemTraySetting> {
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
    } else if (isSystemTraySupported(OS)) {
      const value = this.ephemeralConfig.get('system-tray-setting');
      if (value !== undefined) {
        log.info('getSystemTraySetting got value', value);
      }

      if (value !== undefined) {
        result = parseSystemTraySetting(value);
        log.info(`getSystemTraySetting returning ${result}`);
      } else {
        result = SystemTraySetting.Uninitialized;
        log.info(`getSystemTraySetting got no value, returning ${result}`);
      }

      if (result !== value) {
        this.ephemeralConfig.set('system-tray-setting', result);
      }
    } else {
      result = SystemTraySetting.DoNotUseSystemTray;
      log.info(
        `getSystemTraySetting had no flags and did no DB lookups. Returning ${result}`
      );
    }

    return this.#updateCachedValue(result);
  }

  #updateCachedValue(value: SystemTraySetting): SystemTraySetting {
    // If there's a value in the cache, someone has updated the value "out from under us",
    //   so we should return that because it's newer.
    this.#cachedValue =
      this.#cachedValue === undefined ? value : this.#cachedValue;

    return this.#cachedValue;
  }
}
