// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { getValue } from '../RemoteConfig.dom.ts';
import { safeParseInteger } from './numbers.std.ts';
import { DAY, SECOND } from './durations/index.std.ts';

const DEFAULT_DELETE_MAX_AGE_MS = DAY;

function parseMaxAgeSecsToMs(configValue: string | undefined) {
  if (configValue != null) {
    const parsed = safeParseInteger(configValue);
    if (parsed != null && parsed > 0) {
      return parsed * SECOND;
    }
  }
  return DEFAULT_DELETE_MAX_AGE_MS;
}

export function getNormalDeleteMaxAgeMs(): number {
  return parseMaxAgeSecsToMs(getValue('global.normalDeleteMaxAgeInSeconds'));
}

export function getAdminDeleteMaxAgeMs(): number {
  return parseMaxAgeSecsToMs(getValue('global.adminDeleteMaxAgeInSeconds'));
}
