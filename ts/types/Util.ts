// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export type BodyRangeType = {
  start: number;
  length: number;
  mentionUuid?: string;
  replacementText?: string;
  conversationID?: string;
};

export type BodyRangesType = Array<BodyRangeType>;

export type RenderTextCallbackType = (options: {
  text: string;
  key: number;
}) => JSX.Element | string;

export type ReplacementValuesType = {
  [key: string]: string | number | undefined;
};

export type LocalizerType = {
  (key: string, values?: Array<string> | ReplacementValuesType): string;
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
