// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

//
// Credentials
//

export type Credentials = Readonly<{
  username: string;
  password: string;
}>;

//
// Art
//

export type EmojiData = Readonly<{
  emoji?: string;
  name: string;
  sheetX: number;
  sheetY: number;
}>;

export type Manifest = Readonly<{
  title: string;
  author: string;
}>;

export type AnnotatedImage = Readonly<{
  emoji: EmojiData;
  contentType: string;
  buffer: Uint8Array;
}>;

export type ArtImageData = Readonly<{
  buffer: Uint8Array;
  contentType: string;
  src: string;
  path: string;
}>;

//
// I18N
//

export type LocalizerType = {
  (key: string, values?: ReplacementValuesType): string;
  getIntl(): IntlShape;
  isLegacyFormat(key: string): boolean;
  getLocale(): string;
};

type SmartlingConfigType = Readonly<{
  placeholder_format_custom: string;
  string_format_paths?: string;
  translate_paths: ReadonlyArray<{
    key: string;
    path: string;
    instruction: string;
  }>;
}>;

export type LocaleMessageType = Readonly<{
  message?: string;
  messageformat?: string;
  description?: string;
}>;

export type LocaleMessagesType = Readonly<{
  // In practice, 'smartling' is the only key which is a SmartlingConfigType, but
  //  we get typescript error 2411 (incompatible type signatures) if we try to
  //  special-case that key.
  [key: string]: LocaleMessageType | SmartlingConfigType;
}>;

export type ReplacementValuesType<T = string | number | undefined> = Readonly<{
  [key: string]: T;
}>;

export type LocaleType = Readonly<{
  i18n: LocalizerType;
  messages: LocaleMessagesType;
}>;

export type RenderTextCallbackType = (options: {
  text: string;
  key: number;
}) => JSX.Element | string;
