// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'path';
import { readFile } from 'fs/promises';
import { DNSFallbackSchema } from '../ts/types/DNSFallback';
import type { DNSFallbackType } from '../ts/types/DNSFallback';
import { parseUnknown } from '../ts/util/schemas';

let cached: DNSFallbackType | undefined;

export async function getDNSFallback(): Promise<DNSFallbackType> {
  if (cached != null) {
    return cached;
  }

  const configPath = join(__dirname, '..', 'build', 'dns-fallback.json');
  let str: string;
  try {
    str = await readFile(configPath, 'utf8');
  } catch (error) {
    console.error(
      'Warning: build/dns-fallback.json not build, run `npm run build:dns-fallback`'
    );
    cached = [];
    return cached;
  }

  const json: unknown = JSON.parse(str);

  const result = parseUnknown(DNSFallbackSchema, json);
  cached = result;
  return result;
}
