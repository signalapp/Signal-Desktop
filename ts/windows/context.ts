// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';
import url from 'url';
import type { ParsedUrlQuery } from 'querystring';
import type { IPCEventsValuesType } from '../util/createIPCEvents';
import type { LocalizerType } from '../types/Util';
import type { LoggerType } from '../types/Logging';
import type { NativeThemeType } from '../context/createNativeThemeListener';
import type { SettingType } from '../util/preload';
import { Bytes } from '../context/Bytes';
import { Crypto } from '../context/Crypto';
import { Timers } from '../context/Timers';

import { setupI18n } from '../util/setupI18n';
import {
  getEnvironment,
  parseEnvironment,
  setEnvironment,
} from '../environment';
import { strictAssert } from '../util/assert';
import { createSetting } from '../util/preload';
import { initialize as initializeLogging } from '../logging/set_up_renderer_logging';
import { waitForSettingsChange } from './waitForSettingsChange';
import { createNativeThemeListener } from '../context/createNativeThemeListener';

const config = url.parse(window.location.toString(), true).query;
const { locale } = config;
strictAssert(locale, 'locale could not be parsed from config');
strictAssert(typeof locale === 'string', 'locale is not a string');

const localeMessages = ipcRenderer.sendSync('locale-data');
setEnvironment(parseEnvironment(config.environment));

strictAssert(Boolean(window.SignalContext), 'context must be defined');

initializeLogging();

export type SignalContextType = {
  bytes: Bytes;
  crypto: Crypto;
  timers: Timers;
  nativeThemeListener: NativeThemeType;
  setIsCallActive: (isCallActive: boolean) => unknown;

  Settings: {
    themeSetting: SettingType<IPCEventsValuesType['themeSetting']>;
    waitForChange: () => Promise<void>;
  };
  config: ParsedUrlQuery;
  getAppInstance: () => string | undefined;
  getEnvironment: () => string;
  getNodeVersion: () => string;
  getVersion: () => string;
  getPath: (name: 'userData' | 'home' | 'downloads') => string;
  i18n: LocalizerType;
  log: LoggerType;
  renderWindow?: () => void;
};

export const SignalContext: SignalContextType = {
  Settings: {
    themeSetting: createSetting('themeSetting', { setter: false }),
    waitForChange: waitForSettingsChange,
  },
  bytes: new Bytes(),
  config,
  crypto: new Crypto(),
  getAppInstance: (): string | undefined =>
    config.appInstance ? String(config.appInstance) : undefined,
  getEnvironment,
  getNodeVersion: (): string => String(config.node_version),
  getVersion: (): string => String(config.version),
  getPath: (name: 'userData' | 'home' | 'downloads'): string => {
    return String(config[`${name}Path`]);
  },
  i18n: setupI18n(locale, localeMessages),
  log: window.SignalContext.log,
  nativeThemeListener: createNativeThemeListener(ipcRenderer, window),
  setIsCallActive(isCallActive: boolean): void {
    ipcRenderer.send('set-is-call-active', isCallActive);
  },
  timers: new Timers(),
};

window.SignalContext = SignalContext;
