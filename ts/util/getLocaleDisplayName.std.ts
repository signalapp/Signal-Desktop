// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import LOCALE_DISPLAY_NAMES_JSON from '../../build/locale-display-names.json' with { type: 'json' };
import { assertDev } from './assert.std.ts';

const LOCALE_DISPLAY_NAMES: Partial<
  Record<string, Partial<Record<string, string>>>
> = LOCALE_DISPLAY_NAMES_JSON;

/**
 * Get the display name of `ofLocale` as written in `inLocale`
 */
export function getLocaleDisplayName(
  inLocale: string,
  ofLocale: string
): string {
  const displayName = LOCALE_DISPLAY_NAMES[inLocale]?.[ofLocale];
  assertDev(
    displayName != null,
    `Locale display name in ${inLocale} of ${ofLocale} does not exist`
  );
  return (
    displayName ??
    new Intl.DisplayNames(inLocale, {
      type: 'language',
      languageDisplay: 'standard',
      style: 'long',
      fallback: 'code',
    }).of(ofLocale) ??
    ofLocale
  );
}
