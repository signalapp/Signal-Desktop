// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LocalizerType } from './Util';

export type LocaleMessagesType = {
  [key: string]: {
    message: string;
    description?: string;
    placeholders?: {
      [name: string]: {
        content: string;
        example: string;
      };
    };
  };
};

export type ReplacementValuesType<T> = {
  [key: string]: T;
};

export type LocaleType = {
  i18n: LocalizerType;
  messages: LocaleMessagesType;
};
