// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNumber } from 'lodash';

import { ByteBufferClass } from '../window.d';

export function isByteBufferEmpty(data?: ByteBufferClass): boolean {
  return !data || !isNumber(data.limit) || data.limit === 0;
}
