// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { IntlShape } from 'react-intl';
import React from 'react';
import type { LocaleMessagesType } from '../types/I18N.js';
import type { LocalizerType } from '../types/Util.js';
// eslint-disable-next-line import/no-restricted-paths
import { Emojify } from '../components/conversation/Emojify.js';
import {
  createCachedIntl as createCachedIntlMain,
  setupI18n as setupI18nMain,
} from './setupI18nMain.js';
import type { SetupI18nOptionsType } from './setupI18nMain.js';
import { strictAssert } from './assert.js';

export { isLocaleMessageType } from './setupI18nMain.js';

export function renderEmojify(parts: ReadonlyArray<unknown>): JSX.Element {
  strictAssert(parts.length === 1, '<emojify> must contain only one child');
  const text = parts[0];
  strictAssert(typeof text === 'string', '<emojify> must contain only text');
  return <Emojify text={text} />;
}

export function createCachedIntl(
  locale: string,
  icuMessages: Record<string, string>
): IntlShape {
  return createCachedIntlMain(locale, icuMessages, { renderEmojify });
}

export function setupI18n(
  locale: string,
  messages: LocaleMessagesType,
  options: Omit<SetupI18nOptionsType, 'renderEmojify'> = {}
): LocalizerType {
  return setupI18nMain(locale, messages, { ...options, renderEmojify });
}
