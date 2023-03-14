// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';

import type { MenuOptionsType, MenuActionType } from '../types/menu';
import type { IPCEventsValuesType } from '../util/createIPCEvents';
import type { LocalizerType } from '../types/Util';
import type { LoggerType } from '../types/Logging';
import type { LocaleMessagesType } from '../types/I18N';
import type { NativeThemeType } from '../context/createNativeThemeListener';
import type { SettingType } from '../util/preload';
import type { RendererConfigType } from '../types/RendererConfig';

import { Bytes } from '../context/Bytes';
import { Crypto } from '../context/Crypto';
import { Timers } from '../context/Timers';

import type { ActiveWindowServiceType } from '../services/ActiveWindowService';
import { config } from '../context/config';
import { i18n } from '../context/i18n';
import { activeWindowService } from '../context/activeWindowService';
import {
  getEnvironment,
  parseEnvironment,
  setEnvironment,
} from '../environment';
import { strictAssert } from '../util/assert';
import { createSetting } from '../util/preload';
import { initialize as initializeLogging } from '../logging/set_up_renderer_logging';
import { waitForSettingsChange } from '../context/waitForSettingsChange';
import { createNativeThemeListener } from '../context/createNativeThemeListener';
import {
  isWindows,
  isLinux,
  isMacOS,
  hasCustomTitleBar,
  getClassName,
} from '../OS';

const localeMessages = ipcRenderer.sendSync('locale-data');
setEnvironment(parseEnvironment(config.environment));

strictAssert(Boolean(window.SignalContext), 'context must be defined');

initializeLogging();

export type MainWindowStatsType = Readonly<{
  isMaximized: boolean;
  isFullScreen: boolean;
}>;

export type SignalContextType = {
  bytes: Bytes;
  crypto: Crypto;
  timers: Timers;
  nativeThemeListener: NativeThemeType;
  setIsCallActive: (isCallActive: boolean) => unknown;

  activeWindowService: ActiveWindowServiceType;
  Settings: {
    themeSetting: SettingType<IPCEventsValuesType['themeSetting']>;
    waitForChange: () => Promise<void>;
  };
  OS: {
    platform: string;
    isWindows: typeof isWindows;
    isLinux: typeof isLinux;
    isMacOS: typeof isMacOS;
    hasCustomTitleBar: typeof hasCustomTitleBar;
    getClassName: typeof getClassName;
  };
  config: RendererConfigType;
  getAppInstance: () => string | undefined;
  getEnvironment: () => string;
  getNodeVersion: () => string;
  getVersion: () => string;
  getPath: (name: 'userData' | 'home') => string;
  i18n: LocalizerType;
  localeMessages: LocaleMessagesType;
  log: LoggerType;
  renderWindow?: () => void;
  executeMenuRole: (role: MenuItemConstructorOptions['role']) => Promise<void>;
  getMainWindowStats: () => Promise<MainWindowStatsType>;
  getMenuOptions: () => Promise<MenuOptionsType>;
  executeMenuAction: (action: MenuActionType) => Promise<void>;
};

export const SignalContext: SignalContextType = {
  activeWindowService,
  Settings: {
    themeSetting: createSetting('themeSetting', { setter: false }),
    waitForChange: waitForSettingsChange,
  },
  OS: {
    platform: process.platform,
    isWindows,
    isLinux,
    isMacOS,
    hasCustomTitleBar,
    getClassName,
  },
  bytes: new Bytes(),
  config,
  crypto: new Crypto(),
  getAppInstance: (): string | undefined =>
    config.appInstance ? String(config.appInstance) : undefined,
  getEnvironment,
  getNodeVersion: (): string => String(config.nodeVersion),
  getVersion: (): string => String(config.version),
  getPath: (name: 'userData' | 'home'): string => {
    return String(config[`${name}Path`]);
  },
  i18n,
  localeMessages,
  log: window.SignalContext.log,
  nativeThemeListener: createNativeThemeListener(ipcRenderer, window),
  setIsCallActive(isCallActive: boolean): void {
    ipcRenderer.send('set-is-call-active', isCallActive);
  },
  timers: new Timers(),
  async executeMenuRole(
    role: MenuItemConstructorOptions['role']
  ): Promise<void> {
    await ipcRenderer.invoke('executeMenuRole', role);
  },
  async getMainWindowStats(): Promise<MainWindowStatsType> {
    return ipcRenderer.invoke('getMainWindowStats');
  },
  async getMenuOptions(): Promise<MenuOptionsType> {
    return ipcRenderer.invoke('getMenuOptions');
  },
  async executeMenuAction(action: MenuActionType): Promise<void> {
    return ipcRenderer.invoke('executeMenuAction', action);
  },
};

window.SignalContext = SignalContext;
window.i18n = SignalContext.i18n;
