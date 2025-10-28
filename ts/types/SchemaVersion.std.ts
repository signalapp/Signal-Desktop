// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';

const { isNumber } = lodash;

export const isValid = (value: unknown): value is number => {
  return Boolean(isNumber(value) && value >= 0);
};
