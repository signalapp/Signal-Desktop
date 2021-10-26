// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isValidUuid } from '../types/UUID';
import { assert } from './assert';

export function normalizeUuid(uuid: string, context: string): string {
  assert(
    isValidUuid(uuid),
    `Normalizing invalid uuid: ${uuid} in context "${context}"`
  );

  return uuid.toLowerCase();
}
