// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LocalizerType } from './Util';

export type { LocalizerType } from './Util';

type SmartlingConfigType = {
  placeholder_format_custom: string;
  string_format_paths?: string;
  translate_paths: Array<{
    key: string;
    path: string;
    instruction: string;
  }>;
};

export type LocaleMessageType = {
  messageformat?: string;
  description?: string;
};

export type LocaleMessagesType = {
  // In practice, 'smartling' is the only key which is a SmartlingConfigType, but
  //  we get typescript error 2411 (incompatible type signatures) if we try to
  //  special-case that key.
  [key: string]: LocaleMessageType | SmartlingConfigType;
};

export type ReplacementValuesType<T> = {
  [key: string]: T;
};

export type LocaleType = {
  i18n: LocalizerType;
  messages: LocaleMessagesType;
};
