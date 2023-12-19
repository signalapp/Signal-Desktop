// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { ReactNode } from 'react';

import type { FormatXMLElementFn } from 'intl-messageformat';
import type { LocalizerType } from '../types/Util';
import type { ReplacementValuesType } from '../types/I18N';
import * as log from '../logging/log';
import { strictAssert } from '../util/assert';

export type FullJSXType =
  | FormatXMLElementFn<JSX.Element | string>
  | Array<JSX.Element | string>
  | ReactNode
  | JSX.Element
  | string;
export type IntlComponentsType = undefined | ReplacementValuesType<FullJSXType>;

export type Props = {
  /** The translation string id */
  id: string;
  i18n: LocalizerType;
  components?: IntlComponentsType;
};

export function Intl({
  components,
  id,
  // Indirection for linter/migration tooling
  i18n: localizer,
}: Props): JSX.Element | null {
  if (!id) {
    log.error('Error: Intl id prop not provided');
    return null;
  }

  strictAssert(
    !localizer.isLegacyFormat(id),
    `Legacy message format is no longer supported ${id}`
  );

  strictAssert(
    !Array.isArray(components),
    `components cannot be an array for ICU message ${id}`
  );

  const intl = localizer.getIntl();
  return <>{intl.formatMessage({ id }, components, {})}</>;
}
