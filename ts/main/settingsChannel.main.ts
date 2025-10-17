// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { BrowserWindow } from 'electron';
import { ipcMain as ipc, session } from 'electron';
import { EventEmitter } from 'node:events';

import { createLogger } from '../logging/log.std.js';
import { userConfig } from '../../app/user_config.main.js';
import { ephemeralConfig } from '../../app/ephemeral_config.main.js';
import { installPermissionsHandler } from '../../app/permissions.std.js';
import { strictAssert } from '../util/assert.std.js';

import type { EphemeralSettings } from '../util/preload.preload.js';

const log = createLogger('settingsChannel');

const EPHEMERAL_NAME_MAP = new Map([
  ['spellCheck', 'spell-check'],
  ['systemTraySetting', 'system-tray-setting'],
  ['themeSetting', 'theme-setting'],
  ['localeOverride', 'localeOverride'],
  ['contentProtection', 'contentProtection'],
]);

export class SettingsChannel extends EventEmitter {
  #mainWindow?: BrowserWindow;

  public setMainWindow(mainWindow: BrowserWindow | undefined): void {
    this.#mainWindow = mainWindow;
  }

  public getMainWindow(): BrowserWindow | undefined {
    return this.#mainWindow;
  }

  public openSettingsTab(): void {
    if (!this.#mainWindow) {
      log.warn('openSettingsTab: No mainWindow, cannot open settings tab');
      return;
    }
    this.#mainWindow.webContents.send('open-settings-tab');
    this.#mainWindow.show();
  }

  public install(): void {
    this.#installEphemeralSetting('themeSetting');
    this.#installEphemeralSetting('systemTraySetting');
    this.#installEphemeralSetting('localeOverride');
    this.#installEphemeralSetting('spellCheck');
    this.#installEphemeralSetting('contentProtection');

    installPermissionsHandler({ session: session.defaultSession, userConfig });

    // These ones are different because its single source of truth is userConfig,
    // not IndexedDB
    ipc.handle('settings:get:mediaPermissions', () => {
      return userConfig.get('mediaPermissions') || false;
    });
    ipc.handle('settings:get:mediaCameraPermissions', () => {
      // Intentionally returning `undefined` when unset to let app properly
      // onboard the user.
      return userConfig.get('mediaCameraPermissions');
    });
    ipc.handle('settings:set:mediaPermissions', (_event, value) => {
      userConfig.set('mediaPermissions', value);

      // We reinstall permissions handler to ensure that a revoked permission takes effect
      installPermissionsHandler({
        session: session.defaultSession,
        userConfig,
      });
    });
    ipc.handle('settings:set:mediaCameraPermissions', (_event, value) => {
      userConfig.set('mediaCameraPermissions', value);

      // We reinstall permissions handler to ensure that a revoked permission takes effect
      installPermissionsHandler({
        session: session.defaultSession,
        userConfig,
      });
    });
  }

  #installEphemeralSetting<Name extends keyof EphemeralSettings>(
    name: Name
  ): void {
    ipc.handle(`settings:get:${name}`, async () => {
      const ephemeralName = EPHEMERAL_NAME_MAP.get(name);
      strictAssert(
        ephemeralName !== undefined,
        `${name} is not an ephemeral setting`
      );
      return ephemeralConfig.get(ephemeralName);
    });

    ipc.handle(`settings:set:${name}`, async (_event, value) => {
      const ephemeralName = EPHEMERAL_NAME_MAP.get(name);
      strictAssert(
        ephemeralName !== undefined,
        `${name} is not an ephemeral setting`
      );
      ephemeralConfig.set(ephemeralName, value);

      // Notify main to notify windows of preferences change. As for DB-backed
      // settings, those are set by the renderer, and afterwards the renderer IPC sends
      // to main the event 'preferences-changed'.
      this.emit('ephemeral-setting-changed', name);

      const mainWindow = this.#mainWindow;
      if (!mainWindow || !mainWindow.webContents) {
        return;
      }

      mainWindow.webContents.send(`settings:update:${name}`, value);
    });
  }

  // EventEmitter types

  public override on(
    type: 'change:systemTraySetting',
    callback: (value: string) => void
  ): this;

  public override on(
    type: 'ephemeral-setting-changed',
    callback: (name: string) => void
  ): this;

  public override on(
    type: string | symbol,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listener: (...args: Array<any>) => void
  ): this {
    return super.on(type, listener);
  }

  public override emit(
    type: 'change:systemTraySetting',
    value: string
  ): boolean;

  public override emit(
    type: 'ephemeral-setting-changed',
    name: string
  ): boolean;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public override emit(type: string | symbol, ...args: Array<any>): boolean {
    return super.emit(type, ...args);
  }
}
