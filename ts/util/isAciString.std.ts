// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AciString } from '../types/ServiceId.std.ts';
import { isValidUuid } from './isValidUuid.std.ts';

export function isAciString(value?: string | null): value is AciString {
  return isValidUuid(value);
}
