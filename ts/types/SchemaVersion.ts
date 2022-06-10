// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNumber } from 'lodash';

export const isValid = (value: unknown): value is number => {
  return Boolean(isNumber(value) && value >= 0);
};
