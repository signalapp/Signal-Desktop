// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MenuItemConstructorOptions } from 'electron';
import { ipcRenderer } from 'electron';

import type { MenuOptionsType } from '../types/menu.std.js';
import type { LocaleEmojiListType } from '../types/emoji.std.js';
import { LocaleEmojiListSchema } from '../types/emoji.std.js';
import type {
  MainWindowStatsType,
  MinimalSignalContextType,
} from './context.preload.js';
import { activeWindowService } from '../context/activeWindowService.preload.js';
import { config } from '../context/config.preload.js';
import { createNativeThemeListener } from '../context/createNativeThemeListener.std.js';
import { createSetting } from '../util/preload.preload.js';
import { setupI18n } from '../util/setupI18n.dom.js';
import { environment } from '../context/environment.preload.js';
import {
  localeDisplayNames,
  countryDisplayNames,
  localeMessages,
} from '../context/localeMessages.preload.js';
import { waitForSettingsChange } from '../context/waitForSettingsChange.preload.js';
import { isTestOrMockEnvironment } from '../environment.std.js';
import { parseUnknown } from '../util/schemas.std.js';

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
  i18n: setupI18n(config.resolvedTranslationsLocale, localeMessages),
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
