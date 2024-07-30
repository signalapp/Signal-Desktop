// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'node:path';
import { isString } from 'lodash';

import { getRandomBytes } from '../Crypto';
import * as Bytes from '../Bytes';

export const getRelativePath = (name: string): string => {
  if (!isString(name)) {
    throw new TypeError("'name' must be a string");
  }

  const prefix = name.slice(0, 2);
  return join(prefix, name);
};

export const createName = (suffix = ''): string =>
  `${Bytes.toHex(getRandomBytes(32))}${suffix}`;
