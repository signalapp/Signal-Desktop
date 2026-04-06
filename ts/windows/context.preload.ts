// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MenuItemConstructorOptions } from 'electron';
import { ipcRenderer } from 'electron';

import { Emojify } from '../components/conversation/Emojify.dom.tsx';
import type { NativeThemeType } from '../context/createNativeThemeListener.std.ts';
import type { MenuOptionsType } from '../types/menu.std.ts';
import type { RendererConfigType } from '../types/RendererConfig.std.ts';
import type { LocalizerType } from '../types/Util.std.ts';
import { parseUnknown } from '../util/schemas.std.ts';
import type {
  SettingType,
  SettingsValuesType,
} from '../util/preload.preload.ts';

import { Bytes } from '../context/Bytes.std.ts';
import { Crypto } from '../context/Crypto.node.ts';
import { Timers } from '../context/Timers.node.ts';

import type { LocaleDirection } from '../../app/locale.node.ts';
import { i18n } from '../context/i18n.preload.ts';
import type { ActiveWindowServiceType } from '../services/ActiveWindowService.std.ts';
import type { LocaleEmojiListType } from '../types/emoji.std.ts';
import { LocaleEmojiListSchema } from '../types/emoji.std.ts';
import type { HourCyclePreference } from '../types/I18N.std.ts';
import { MinimalSignalContext } from './minimalContext.preload.ts';

export type MainWindowStatsType = Readonly<{
  isMaximized: boolean;
  isFullScreen: boolean;
}>;

export type MinimalSignalContextType = {
  activeWindowService: ActiveWindowServiceType;
  config: RendererConfigType;
  executeMenuRole: (role: MenuItemConstructorOptions['role']) => Promise<void>;
  getAppInstance: () => string | undefined;
  getEnvironment: () => string;
  getI18nAvailableLocales: () => ReadonlyArray<string>;
  getI18nLocale: LocalizerType['getLocale'];
  getI18nLocaleMessages: LocalizerType['getLocaleMessages'];
  i18n: LocalizerType;
  getLocaleDisplayNames: () => Record<string, Record<string, string>>;
  getCountryDisplayNames: () => Record<string, Record<string, string>>;
  getResolvedMessagesLocaleDirection: () => LocaleDirection;
  getHourCyclePreference: () => HourCyclePreference;
  getResolvedMessagesLocale: () => string;
  getPreferredSystemLocales: () => Array<string>;
  getLocaleOverride: () => string | null;
  getMainWindowStats: () => Promise<MainWindowStatsType>;
  getMenuOptions: () => Promise<MenuOptionsType>;
  getNodeVersion: () => string;
  getPath: (name: 'userData' | 'home' | 'install') => string;
  getVersion: () => string;
  isTestOrMockEnvironment: () => boolean;
  nativeThemeListener: NativeThemeType;
  restartApp: () => void;
  Settings: {
    themeSetting: SettingType<SettingsValuesType['themeSetting']>;
    waitForChange: () => Promise<void>;
  };
  OS: {
    getClassName: () => string;
    platform: string;
    release: string;
  };
  Emojify: typeof Emojify | undefined;
};

export type SignalContextType = {
  bytes: Bytes;
  crypto: Crypto;
  setIsCallActive: (isCallActive: boolean) => unknown;
  timers: Timers;
  Emojify: typeof Emojify;
  getLocalizedEmojiList: (locale: string) => Promise<LocaleEmojiListType>;
} & MinimalSignalContextType;

const emojiListCache = new Map<string, LocaleEmojiListType>();

export const SignalContext: SignalContextType = {
  ...MinimalSignalContext,
  bytes: new Bytes(),
  crypto: new Crypto(),
  i18n,
  setIsCallActive(isCallActive: boolean): void {
    ipcRenderer.send('set-is-call-active', isCallActive);
  },
  timers: new Timers(),
  Emojify,
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
};

window.SignalContext = SignalContext;
