// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type {
  LocalizerType,
  ICUJSXMessageParamsByKeyType,
} from '../types/Util.std.js';
import { strictAssert } from '../util/assert.std.js';

export type Props<Key extends keyof ICUJSXMessageParamsByKeyType> = {
  /** The translation string id */
  id: Key;
  i18n: LocalizerType;
} & (ICUJSXMessageParamsByKeyType[Key] extends undefined
  ? {
      components?: ICUJSXMessageParamsByKeyType[Key];
    }
  : {
      components: ICUJSXMessageParamsByKeyType[Key];
    });

export function I18n<Key extends keyof ICUJSXMessageParamsByKeyType>({
  components,
  id,
  // Indirection for linter/migration tooling
  i18n: localizer,
}: Props<Key>): JSX.Element | null {
  strictAssert(id != null, 'Error: <I18n> id prop not provided');
  const intl = localizer.getIntl();
  return <>{intl.formatMessage({ id }, components, {})}</>;
}
