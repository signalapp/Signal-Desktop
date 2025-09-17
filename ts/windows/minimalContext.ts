// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MenuItemConstructorOptions } from 'electron';
import { ipcRenderer } from 'electron';

import type { MenuOptionsType } from '../types/menu.js';
import type { LocaleEmojiListType } from '../types/emoji.js';
import { LocaleEmojiListSchema } from '../types/emoji.js';
import type {
  MainWindowStatsType,
  MinimalSignalContextType,
} from './context.js';
import { activeWindowService } from '../context/activeWindowService.js';
import { config } from '../context/config.js';
import { createNativeThemeListener } from '../context/createNativeThemeListener.js';
import { createSetting } from '../util/preload.js';
import { environment } from '../context/environment.js';
import {
  localeDisplayNames,
  countryDisplayNames,
  localeMessages,
} from '../context/localeMessages.js';
import { waitForSettingsChange } from '../context/waitForSettingsChange.js';
import { isTestOrMockEnvironment } from '../environment.js';
import { parseUnknown } from '../util/schemas.js';

const emojiListCache = new Map<string, LocaleEmojiListType>();

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
  async getLocalizedEmojiList(locale: string) {
    const cached = emojiListCache.get(locale);
    if (cached) {
      return cached;
    }

    const buf = await ipcRenderer.invoke(
      'OptionalResourceService:getData',
      `emoji-index-${locale}.json`
    );
    const json: unknown = JSON.parse(Buffer.from(buf).toString());
    const result = parseUnknown(LocaleEmojiListSchema, json);
    emojiListCache.set(locale, result);
    return result;
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
  isTestOrMockEnvironment,
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
