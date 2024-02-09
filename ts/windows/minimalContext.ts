// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MenuItemConstructorOptions } from 'electron';
import { ipcRenderer } from 'electron';

import type { MenuOptionsType } from '../types/menu';
import type { MainWindowStatsType, MinimalSignalContextType } from './context';
import { activeWindowService } from '../context/activeWindowService';
import { config } from '../context/config';
import { createNativeThemeListener } from '../context/createNativeThemeListener';
import { createSetting } from '../util/preload';
import { environment } from '../context/environment';
import {
  localeDisplayNames,
  countryDisplayNames,
  localeMessages,
} from '../context/localeMessages';
import { waitForSettingsChange } from '../context/waitForSettingsChange';

export const MinimalSignalContext: MinimalSignalContextType = {
  activeWindowService,
  config,
  async executeMenuRole(
    role: MenuItemConstructorOptions['role']
  ): Promise<void> {
    await ipcRenderer.invoke('executeMenuRole', role);
  },
  getAppInstance: (): string | undefined =>
    config.appInstance ? String(config.appInstance) : undefined,
  getEnvironment: () => environment,
  getNodeVersion: (): string => String(config.nodeVersion),
  getPath: (name: 'userData' | 'home' | 'install'): string => {
    return String(config[`${name}Path`]);
  },
  getVersion: (): string => String(config.version),
  async getMainWindowStats(): Promise<MainWindowStatsType> {
    return ipcRenderer.invoke('getMainWindowStats');
  },
  async getMenuOptions(): Promise<MenuOptionsType> {
    return ipcRenderer.invoke('getMenuOptions');
  },
  getI18nAvailableLocales: () => config.availableLocales,
  getI18nLocale: () => config.resolvedTranslationsLocale,
  getI18nLocaleMessages: () => localeMessages,
  getLocaleDisplayNames: () => localeDisplayNames,
  getCountryDisplayNames: () => countryDisplayNames,

  getResolvedMessagesLocale: () => config.resolvedTranslationsLocale,
  getResolvedMessagesLocaleDirection: () =>
    config.resolvedTranslationsLocaleDirection,
  getHourCyclePreference: () => config.hourCyclePreference,
  getPreferredSystemLocales: () => config.preferredSystemLocales,
  getLocaleOverride: () => config.localeOverride,
  nativeThemeListener: createNativeThemeListener(ipcRenderer, window),
  restartApp: () => ipcRenderer.send('restart'),
  OS: {
    getClassName: () => ipcRenderer.sendSync('OS.getClassName'),
    platform: process.platform,
    release: config.osRelease,
  },
  Settings: {
    themeSetting: createSetting('themeSetting', { setter: false }),
    waitForChange: waitForSettingsChange,
  },
};
