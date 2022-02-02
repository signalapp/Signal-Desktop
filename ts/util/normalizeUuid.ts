// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { UUIDStringType } from '../types/UUID';
import { isValidUuid } from '../types/UUID';
import { assert } from './assert';

export function normalizeUuid(uuid: string, context: string): UUIDStringType {
  const result = uuid.toLowerCase();

  assert(
    isValidUuid(uuid) && isValidUuid(result),
    `Normalizing invalid uuid: ${uuid} to ${result} in context "${context}"`
  );

  return result;
}
