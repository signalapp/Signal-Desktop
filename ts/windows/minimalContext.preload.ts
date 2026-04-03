// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MenuItemConstructorOptions } from 'electron';
import { ipcRenderer } from 'electron';

import type { MenuOptionsType } from '../types/menu.std.ts';
import type { LocaleEmojiListType } from '../types/emoji.std.ts';
import { LocaleEmojiListSchema } from '../types/emoji.std.ts';
import type {
  MainWindowStatsType,
  MinimalSignalContextType,
} from './context.preload.ts';
import { activeWindowService } from '../context/activeWindowService.preload.ts';
import { config } from '../context/config.preload.ts';
import { createNativeThemeListener } from '../context/createNativeThemeListener.std.ts';
import { createSetting } from '../util/preload.preload.ts';
import { setupI18n } from '../util/setupI18n.dom.tsx';
import { environment } from '../context/environment.preload.ts';
import {
  localeDisplayNames,
  countryDisplayNames,
  localeMessages,
} from '../context/localeMessages.preload.ts';
import { waitForSettingsChange } from '../context/waitForSettingsChange.preload.ts';
import { isTestOrMockEnvironment } from '../environment.std.ts';
import { parseUnknown } from '../util/schemas.std.ts';

const emojiListCache = new Map<string, LocaleEmojiListType>();

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
