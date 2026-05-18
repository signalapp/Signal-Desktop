// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { getValue } from '../RemoteConfig.dom.ts';
import { safeParseNumber } from './numbers.std.ts';

const DEFAULT_ARCHIVE_NON_SPQR_SESSION_PROBABILITY = 0.0;

export function getRequirePqRatio(): number {
  const ratioStr = getValue('desktop.requirePqRatio');
  if (ratioStr != null) {
    const parsed = safeParseNumber(ratioStr);
    if (parsed != null) {
      return parsed;
    }
  }
  return DEFAULT_ARCHIVE_NON_SPQR_SESSION_PROBABILITY;
}
