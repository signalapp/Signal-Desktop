// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { IntlShape } from 'react-intl';
import type { UUIDStringType } from './UUID';

// Cold storage of body ranges

export type BodyRangeType = {
  start: number;
  length: number;
  mentionUuid: string;
};

export type BodyRangesType = ReadonlyArray<BodyRangeType>;

// Used exclusive in CompositionArea and related conversation_view.tsx calls.

export type DraftBodyRangeType = BodyRangeType & {
  replacementText: string;
};

export type DraftBodyRangesType = ReadonlyArray<DraftBodyRangeType>;

// Fully hydrated body range to be used in UI components.

export type HydratedBodyRangeType = DraftBodyRangeType & {
  conversationID: string;
};

export type HydratedBodyRangesType = ReadonlyArray<HydratedBodyRangeType>;

export type StoryContextType = {
  authorUuid?: UUIDStringType;
  timestamp: number;
};

export type RenderTextCallbackType = (options: {
  text: string;
  key: number;
}) => JSX.Element | string;

export type ReplacementValuesType =
  | Array<string>
  | {
      [key: string]: string | number | undefined;
    };

export type LocalizerType = {
  (key: string, values?: ReplacementValuesType): string;
  getIntl(): IntlShape;
  isLegacyFormat(key: string): boolean;
  getLocale(): string;
};

export enum ThemeType {
  'light' = 'light',
  'dark' = 'dark',
}

// These are strings so they can be interpolated into class names.
export enum ScrollBehavior {
  Default = 'default',
  Hard = 'hard',
}

type InternalAssertProps<
  Result,
  Value,
  Missing = Omit<Result, keyof Value>
> = keyof Missing extends never
  ? Result
  : Result & {
      [key in keyof Required<Missing>]: [
        never,
        'AssertProps: missing property'
      ];
    };

export type AssertProps<Result, Value> = InternalAssertProps<Result, Value>;

export type UnwrapPromise<Value> = Value extends Promise<infer T> ? T : Value;

export type BytesToStrings<Value> = Value extends Uint8Array
  ? string
  : { [Key in keyof Value]: BytesToStrings<Value[Key]> };
