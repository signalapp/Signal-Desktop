// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { LocaleMessagesType } from '../types/I18N.std.ts';
import type { LocalizerType } from '../types/Util.std.ts';
import { setupI18n as setupI18nMain } from './setupI18nMain.std.ts';
import type { SetupI18nOptionsType } from './setupI18nMain.std.ts';
import { strictAssert } from './assert.std.ts';

function renderEmojify(parts: ReadonlyArray<unknown>): React.JSX.Element {
  strictAssert(parts.length === 1, '<emojify> must contain only one child');
  const text = parts[0];
  strictAssert(typeof text === 'string', '<emojify> must contain only text');
  const { Emojify } = window.SignalContext;
  if (Emojify != null) {
    return <Emojify text={text} />;
  }
  return <>{text}</>;
}

function getLocaleDirection() {
  return window.SignalContext.getResolvedMessagesLocaleDirection();
}
function getHourCyclePreference() {
  return window.SignalContext.getHourCyclePreference();
}

export function setupI18n(
  locale: string,
  messages: LocaleMessagesType,
  options: Omit<
    SetupI18nOptionsType,
    'renderEmojify' | 'getLocaleDirection' | 'getHourCyclePreference'
  > = {}
): LocalizerType {
  return setupI18nMain(locale, messages, {
    ...options,
    renderEmojify,
    getLocaleDirection,
    getHourCyclePreference,
  });
}
