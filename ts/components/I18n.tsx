// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type {
  LocalizerType,
  ICUJSXMessageParamsByKeyType,
} from '../types/Util';
import * as log from '../logging/log';

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
  if (!id) {
    log.error('Error: <I18n> id prop not provided');
    return null;
  }

  const intl = localizer.getIntl();
  return <>{intl.formatMessage({ id }, components, {})}</>;
}
