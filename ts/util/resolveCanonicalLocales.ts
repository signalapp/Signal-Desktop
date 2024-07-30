// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function resolveCanonicalLocales(locales: Array<string>): Array<string> {
  const validLocales = locales.filter(locale => {
    try {
      // Test if the locale is valid
      new Intl.Locale(locale).maximize();
      return true;
    } catch {
      return false;
    }
  });
  const canonical = Intl.getCanonicalLocales(validLocales);
  if (canonical.length === 0) {
    return ['en'];
  }
  return canonical;
}
