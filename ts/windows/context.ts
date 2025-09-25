// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MenuItemConstructorOptions } from 'electron';
import { ipcRenderer } from 'electron';

import type { NativeThemeType } from '../context/createNativeThemeListener.js';
import type { MenuOptionsType } from '../types/menu.js';
import type { RendererConfigType } from '../types/RendererConfig.js';
import type { LocalizerType } from '../types/Util.js';
import type { SettingType, SettingsValuesType } from '../util/preload.js';

import { Bytes } from '../context/Bytes.js';
import { Crypto } from '../context/Crypto.js';
import { Timers } from '../context/Timers.js';

import type { LocaleDirection } from '../../app/locale.js';
import { i18n } from '../context/i18n.js';
import type { ActiveWindowServiceType } from '../services/ActiveWindowService.js';
import type { LocaleEmojiListType } from '../types/emoji.js';
import type { HourCyclePreference } from '../types/I18N.js';
import { MinimalSignalContext } from './minimalContext.js';

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
  i18n: LocalizerType;
  renderWindow?: () => void;
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
window.i18n = SignalContext.i18n;
