// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { v4 as generateUuid } from 'uuid';
import type { AciString, PniString } from '../types/ServiceId.std.ts';

// For tests
export function generateAci(): AciString {
  return generateUuid() as AciString;
}

export function generatePni(): PniString {
  return `PNI:${generateUuid()}` as PniString;
}

export function getAciFromPrefix(prefix: string): AciString {
  let padded = prefix;
  while (padded.length < 8) {
    padded += '0';
  }
  return `${padded}-0000-4000-8000-${'0'.repeat(12)}` as AciString;
}
