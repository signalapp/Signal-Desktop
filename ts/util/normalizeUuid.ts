// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from './assert';
import { isValidGuid } from './isValidGuid';

export function normalizeUuid(uuid: string, context: string): string {
  assert(
    isValidGuid(uuid),
    `Normalizing invalid uuid: ${uuid} in context "${context}"`
  );

  return uuid.toLowerCase();
}
