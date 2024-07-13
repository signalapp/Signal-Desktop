// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';
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
  ignoreUnused?: boolean;
};

export type LocaleMessagesType = {
  // In practice, 'smartling' is the only key which is a SmartlingConfigType, but
  //  we get typescript error 2411 (incompatible type signatures) if we try to
  //  special-case that key.
  [key: string]: LocaleMessageType | SmartlingConfigType;
};

export type LocaleType = {
  i18n: LocalizerType;
  messages: LocaleMessagesType;
};

export enum HourCyclePreference {
  Prefer24 = 'Prefer24', // either h23 or h24
  Prefer12 = 'Prefer12', // either h11 or h12
  UnknownPreference = 'UnknownPreference',
}

export const HourCyclePreferenceSchema = z.nativeEnum(HourCyclePreference);
