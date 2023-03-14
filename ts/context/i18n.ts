// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';
import { config } from './config';
import { setupI18n } from '../util/setupI18n';
import { strictAssert } from '../util/assert';

const { resolvedTranslationsLocale } = config;
strictAssert(
  resolvedTranslationsLocale,
  'locale could not be parsed from config'
);
strictAssert(
  typeof resolvedTranslationsLocale === 'string',
  'locale is not a string'
);

const localeMessages = ipcRenderer.sendSync('locale-data');
const i18n = setupI18n(resolvedTranslationsLocale, localeMessages);

export { i18n };
