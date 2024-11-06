// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { IntlShape } from 'react-intl';
import type { AciString } from './ServiceId';
import type { LocaleDirection } from '../../app/locale';
import type {
  ICUJSXMessageParamsByKeyType,
  ICUStringMessageParamsByKeyType,
} from '../../build/ICUMessageParams.d';

import type { HourCyclePreference, LocaleMessagesType } from './I18N';

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
