// Copyright 2018-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { readJsonSync, writeJsonSync } from 'fs-extra';

import { orderBy } from 'lodash';

import type { ExceptionType } from './types';

export const ENCODING = 'utf8';

export const loadJSON = <T>(path: string): T => readJsonSync(path);

export const writeExceptions = (
  path: string,
  exceptions: ReadonlyArray<ExceptionType>
): void => writeJsonSync(path, sortExceptions(exceptions), { spaces: 2 });

export const sortExceptions = (
  exceptions: ReadonlyArray<ExceptionType>
): Array<ExceptionType> =>
  orderBy(exceptions, [
    'path',
    'rule',
    'reasonCategory',
    'updated',
    'reasonDetail',
  ]);
