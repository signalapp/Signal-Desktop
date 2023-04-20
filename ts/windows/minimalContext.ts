// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MenuItemConstructorOptions } from 'electron';
import { ipcRenderer } from 'electron';

import type { MenuOptionsType, MenuActionType } from '../types/menu';
import type { MainWindowStatsType, MinimalSignalContextType } from './context';
import { activeWindowService } from '../context/activeWindowService';
import { config } from '../context/config';
import { createNativeThemeListener } from '../context/createNativeThemeListener';
import { createSetting } from '../util/preload';
import { environment } from '../context/environment';
import { localeMessages } from '../context/localeMessages';
import { waitForSettingsChange } from '../context/waitForSettingsChange';

const hasCustomTitleBar = ipcRenderer.sendSync('OS.getHasCustomTitleBar');
export const MinimalSignalContext: MinimalSignalContextType = {
  activeWindowService,
  config,
  async executeMenuAction(action: MenuActionType): Promise<void> {
    return ipcRenderer.invoke('executeMenuAction', action);
  },
  async executeMenuRole(
    role: MenuItemConstructorOptions['role']
  ): Promise<void> {
    await ipcRenderer.invoke('executeMenuRole', role);
  },
  getAppInstance: (): string | undefined =>
    config.appInstance ? String(config.appInstance) : undefined,
  getEnvironment: () => environment,
  getNodeVersion: (): string => String(config.nodeVersion),
  getPath: (name: 'userData' | 'home'): string => {
    return String(config[`${name}Path`]);
  },
  getVersion: (): string => String(config.version),
  async getMainWindowStats(): Promise<MainWindowStatsType> {
    return ipcRenderer.invoke('getMainWindowStats');
  },
  async getMenuOptions(): Promise<MenuOptionsType> {
    return ipcRenderer.invoke('getMenuOptions');
  },
  getI18nLocale: () => config.resolvedTranslationsLocale,
  getI18nLocaleMessages: () => localeMessages,
  nativeThemeListener: createNativeThemeListener(ipcRenderer, window),
  OS: {
    getClassName: () => ipcRenderer.sendSync('OS.getClassName'),
    hasCustomTitleBar: () => hasCustomTitleBar,
    platform: process.platform,
    release: config.osRelease,
  },
  Settings: {
    themeSetting: createSetting('themeSetting', { setter: false }),
    waitForChange: waitForSettingsChange,
  },
};
