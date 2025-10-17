// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { contextBridge } from 'electron';
import { config } from '../../context/config.preload.js';
import { localeMessages } from '../../context/localeMessages.preload.js';

contextBridge.exposeInMainWorld('SignalContext', {
  getI18nLocale: () => config.resolvedTranslationsLocale,
  getI18nLocaleMessages: () => localeMessages,
});
