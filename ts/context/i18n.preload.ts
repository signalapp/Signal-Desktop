// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { config } from './config.preload.ts';
import { localeMessages } from './localeMessages.preload.ts';
import { setupI18n } from '../util/setupI18n.dom.tsx';
import { strictAssert } from '../util/assert.std.ts';

const { resolvedTranslationsLocale } = config;
strictAssert(
  resolvedTranslationsLocale,
  'locale could not be parsed from config'
);
strictAssert(
  typeof resolvedTranslationsLocale === 'string',
  'locale is not a string'
);

const i18n = setupI18n(resolvedTranslationsLocale, localeMessages);

export { i18n };
