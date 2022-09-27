// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable camelcase */

import type { LocalizerType } from './Util';

export type { LocalizerType } from './Util';

type SmartlingConfigType = {
  placeholder_format_custom: string;
  translate_paths: Array<{
    key: string;
    path: string;
    instruction: string;
  }>;
};

type LocaleMessageType = {
  message: string;
  description?: string;
  placeholders?: {
    [name: string]: {
      content: string;
      example: string;
    };
  };
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
