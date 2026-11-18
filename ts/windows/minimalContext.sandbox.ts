// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MenuItemConstructorOptions } from 'electron';
import { ipcRenderer } from 'electron';

import type { MenuOptionsType } from '../types/menu.std.ts';
import type {
  MainWindowStatsType,
  MinimalSignalContextType,
} from './context.sandbox.ts';
import { activeWindowService } from '../context/activeWindowService.sandbox.ts';
import { config } from '../context/config.sandbox.ts';
import { createNativeThemeListener } from '../context/createNativeThemeListener.std.ts';
import { createSetting } from '../util/preload.sandbox.ts';
import { setupI18n } from '../util/setupI18n.dom.tsx';
import { environment } from '../context/environment.sandbox.ts';
import {
  countryDisplayNames,
  localeMessages,
} from '../context/localeMessages.sandbox.ts';
import { waitForSettingsChange } from '../context/waitForSettingsChange.sandbox.ts';
import { isTestOrMockEnvironment } from '../environment.std.ts';

export const MinimalSignalContext: MinimalSignalContextType = {
  activeWindowService,
  config,
  async executeMenuRole(
    role: MenuItemConstructorOptions['role']
  ): Promise<void> {
    await ipcRenderer.invoke('executeMenuRole', role);
  },
  getAppInstance: (): string | undefined => config.appInstance,
  getEnvironment: () => environment,
  getNodeVersion: (): string => config.nodeVersion,
  getPath: (name: 'userData' | 'home' | 'install'): string => {
    return config[`${name}Path`];
  },
  getVersion: (): string => config.version,
  async getMainWindowStats(): Promise<MainWindowStatsType> {
    return ipcRenderer.invoke('getMainWindowStats');
  },
  async getMenuOptions(): Promise<MenuOptionsType> {
    return ipcRenderer.invoke('getMenuOptions');
  },
  getI18nLocale: () => config.resolvedTranslationsLocale,
  getI18nLocaleMessages: () => localeMessages,
  i18n: setupI18n(config.resolvedTranslationsLocale, localeMessages),
  getCountryDisplayNames: () => countryDisplayNames,

  getResolvedMessagesLocale: () => config.resolvedTranslationsLocale,
  getResolvedMessagesLocaleDirection: () =>
    config.resolvedTranslationsLocaleDirection,
  getHourCyclePreference: () => config.hourCyclePreference,
  getPreferredSystemLocales: () => config.preferredSystemLocales,
  getLocaleOverride: () => config.localeOverride,
  isTestOrMockEnvironment,
  nativeThemeListener: createNativeThemeListener(ipcRenderer, window),
  restartApp: () => ipcRenderer.send('restart'),
  OS: {
    // oxlint-disable-next-line signal-desktop/enforce-static-class-names
    getClassName: () => ipcRenderer.sendSync('OS.getClassName'),
    platform: process.platform,
    release: config.osRelease,
  },
  Settings: {
    themeSetting: createSetting('themeSetting', { setter: false }),
    waitForChange: waitForSettingsChange,
  },
  Emojify: undefined,
};
