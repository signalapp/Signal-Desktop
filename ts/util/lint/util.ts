// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-console */

import { readFileSync } from 'fs';

import { omit, orderBy } from 'lodash';

import type { ExceptionType } from './types';

export const ENCODING = 'utf8';

export function loadJSON<T>(target: string): T {
  try {
    const contents = readFileSync(target, ENCODING);

    return JSON.parse(contents);
  } catch (error) {
    console.log(`Error loading JSON from ${target}: ${error.stack}`);
    throw error;
  }
}

export function sortExceptions(
  exceptions: Array<ExceptionType>
): Array<ExceptionType> {
  return orderBy(exceptions, [
    'path',
    'rule',
    'reasonCategory',
    'updated',
    'reasonDetail',
  ]).map(removeLegacyAttributes);
}

// This is here in case any open changesets still touch `lineNumber`. We should remove
//   this after 2021-06-01 to be conservative.
function removeLegacyAttributes(
  exception: Readonly<ExceptionType>
): ExceptionType {
  return omit(exception, ['lineNumber']);
}
