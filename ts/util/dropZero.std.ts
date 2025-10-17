// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';

const { isNumber } = lodash;

export function dropZero(value: number | null | undefined): number | undefined {
  if (isNumber(value) && value !== 0) {
    return value;
  }
  return undefined;
}
