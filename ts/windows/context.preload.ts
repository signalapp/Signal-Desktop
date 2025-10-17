// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MenuItemConstructorOptions } from 'electron';
import { ipcRenderer } from 'electron';

import type { NativeThemeType } from '../context/createNativeThemeListener.std.js';
import type { MenuOptionsType } from '../types/menu.std.js';
import type { RendererConfigType } from '../types/RendererConfig.std.js';
import type { LocalizerType } from '../types/Util.std.js';
import type {
  SettingType,
  SettingsValuesType,
} from '../util/preload.preload.js';

import { Bytes } from '../context/Bytes.std.js';
import { Crypto } from '../context/Crypto.node.js';
import { Timers } from '../context/Timers.node.js';

import type { LocaleDirection } from '../../app/locale.main.js';
import { i18n } from '../context/i18n.preload.js';
import type { ActiveWindowServiceType } from '../services/ActiveWindowService.std.js';
import type { LocaleEmojiListType } from '../types/emoji.std.js';
import type { HourCyclePreference } from '../types/I18N.std.js';
import { MinimalSignalContext } from './minimalContext.preload.js';

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
  getLocalizedEmojiList: (locale: string) => Promise<LocaleEmojiListType>;
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
};

export type SignalContextType = {
  bytes: Bytes;
  crypto: Crypto;
  setIsCallActive: (isCallActive: boolean) => unknown;
  timers: Timers;
} & MinimalSignalContextType;

export const SignalContext: SignalContextType = {
  ...MinimalSignalContext,
  bytes: new Bytes(),
  crypto: new Crypto(),
  i18n,
  setIsCallActive(isCallActive: boolean): void {
    ipcRenderer.send('set-is-call-active', isCallActive);
  },
  timers: new Timers(),
};

window.SignalContext = SignalContext;
