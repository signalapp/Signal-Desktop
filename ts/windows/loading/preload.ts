// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { contextBridge } from 'electron';
import { config } from '../../context/config';
import { localeMessages } from '../../context/localeMessages';

contextBridge.exposeInMainWorld('SignalContext', {
  getI18nLocale: () => config.resolvedTranslationsLocale,
  getI18nLocaleMessages: () => localeMessages,
});
