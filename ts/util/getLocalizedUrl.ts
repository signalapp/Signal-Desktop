// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { mapToSupportLocale } from './mapToSupportLocale';

/**
 * Ensures the provided string contains "LOCALE".
 * If not, produces a readable TypeScript error.
 */
type RequiresLocale<T extends string> = T extends `${string}LOCALE${string}`
  ? T
  : `Error: The URL must contain "LOCALE" but got "${T}"`;

/**
 * Replaces "LOCALE" in a URL with the appropriate localized support locale.
 *
 * @param url The URL string containing "LOCALE" to be replaced
 * @returns The URL with "LOCALE" replaced with the appropriate locale
 */
export function getLocalizedUrl<T extends string>(
  url: RequiresLocale<T>
): string {
  const locale = window.SignalContext.getResolvedMessagesLocale();
  const supportLocale = mapToSupportLocale(locale);
  return url.replace('LOCALE', supportLocale);
}
