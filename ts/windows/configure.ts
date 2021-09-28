// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import url from 'url';
import { ipcRenderer } from 'electron';

import { setupI18n } from '../util/setupI18n';
import {
  getEnvironment,
  parseEnvironment,
  setEnvironment,
} from '../environment';
import { strictAssert } from '../util/assert';
import { createSetting } from '../util/preload';
import { initialize as initializeLogging } from '../logging/set_up_renderer_logging';

const config = url.parse(window.location.toString(), true).query;
const { locale } = config;
strictAssert(locale, 'locale could not be parsed from config');
strictAssert(typeof locale === 'string', 'locale is not a string');

const localeMessages = ipcRenderer.sendSync('locale-data');
setEnvironment(parseEnvironment(config.environment));

strictAssert(Boolean(window.SignalContext), 'context must be defined');

initializeLogging();

export const SignalWindow = {
  Settings: {
    themeSetting: createSetting('themeSetting', { setter: false }),
  },
  config,
  context: window.SignalContext,
  getAppInstance: (): string | undefined =>
    config.appInstance ? String(config.appInstance) : undefined,
  getEnvironment,
  getVersion: (): string => String(config.version),
  i18n: setupI18n(locale, localeMessages),
  log: window.SignalWindow.log,
};
