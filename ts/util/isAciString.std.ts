// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AciString } from '../types/ServiceId.std.js';
import { isValidUuid } from './isValidUuid.std.js';

export function isAciString(value?: string | null): value is AciString {
  return isValidUuid(value);
}
