// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { IntlShape } from 'react-intl';
import type { AciString } from './ServiceId.std.js';
import type { LocaleDirection } from '../../app/locale.node.js';
import type {
  ICUJSXMessageParamsByKeyType,
  ICUStringMessageParamsByKeyType,
} from '../../build/ICUMessageParams.d.ts';

import type { HourCyclePreference, LocaleMessagesType } from './I18N.std.js';

export type StoryContextType = {
  authorAci?: AciString;
  timestamp: number;
};

export type RenderTextCallbackType = (options: {
  text: string;
  key: number;
}) => JSX.Element | string;

export { ICUJSXMessageParamsByKeyType, ICUStringMessageParamsByKeyType };

export type LocalizerOptions = {
  /**
   * - 'default' will fence all string parameters with unicode bidi isolates
   *   and balance the control characters within them
   * - 'strip' should only be used when all of the parameters are not
   *   user-generated and should not contain any control characters.
   */
  bidi?: 'default' | 'strip';
};

export type LocalizerType = {
  <Key extends keyof ICUStringMessageParamsByKeyType>(
    key: Key,
    ...values: ICUStringMessageParamsByKeyType[Key] extends undefined
      ? [params?: undefined, options?: LocalizerOptions]
      : [
          params: ICUStringMessageParamsByKeyType[Key],
          options?: LocalizerOptions,
        ]
  ): string;
  getIntl(): IntlShape;
  getLocale(): string;
  getLocaleMessages(): LocaleMessagesType;
  getLocaleDirection(): LocaleDirection;
  getHourCyclePreference(): HourCyclePreference;

  // Storybook
  trackUsage(): void;
  stopTrackingUsage(): Array<[string, string]>;
};

export enum SentMediaQualityType {
  'standard' = 'standard',
  'high' = 'high',
}

export enum ThemeType {
  'light' = 'light',
  'dark' = 'dark',
}

export enum SystemThemeType {
  light = 'light',
  dark = 'dark',
}

// These are strings so they can be interpolated into class names.
export enum ScrollBehavior {
  Default = 'default',
  Hard = 'hard',
}

type InternalAssertProps<
  Result,
  Value,
  Missing = Omit<Result, keyof Value>,
> = keyof Missing extends never
  ? Result
  : Result & {
      [key in keyof Required<Missing>]: [
        never,
        'AssertProps: missing property',
      ];
    };

export type AssertProps<Result, Value> = InternalAssertProps<Result, Value>;

export type UnwrapPromise<Value> = Value extends Promise<infer T> ? T : Value;

export type BytesToStrings<Value> = Value extends Uint8Array
  ? string
  : { [Key in keyof Value]: BytesToStrings<Value[Key]> };

export type JSONWithUnknownFields<Value> =
  Value extends Record<string | symbol | number, unknown>
    ? Readonly<
        {
          [Key in keyof Value]: JSONWithUnknownFields<Value[Key]>;
        } & {
          // Make sure that rest property is required to handle.
          __rest: never;
        }
      >
    : Value extends Array<infer E>
      ? ReadonlyArray<JSONWithUnknownFields<E>>
      : Value;

export type WithRequiredProperties<T, P extends keyof T> = Omit<T, P> &
  Required<Pick<T, P>>;

export type WithOptionalProperties<T, P extends keyof T> = Omit<T, P> &
  Partial<Pick<T, P>>;

// Check that two const arrays do not have overlapping values
export type ErrorIfOverlapping<
  T1 extends ReadonlyArray<unknown>,
  T2 extends ReadonlyArray<unknown>,
> = T1[number] & T2[number] extends never
  ? void
  : 'Error: Arrays have overlapping values';

// Check that T has all the fields (and only those fields) from K
export type ExactKeys<T, K extends ReadonlyArray<string>> =
  Exclude<keyof T, K[number]> extends never
    ? Exclude<K[number], keyof T> extends never
      ? T
      : 'Error: Array has fields not present in object type'
    : 'Error: Object type has keys not present in array';
