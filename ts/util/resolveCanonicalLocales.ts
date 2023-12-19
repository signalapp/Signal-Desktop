// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function resolveCanonicalLocales(locales: Array<string>): Array<string> {
  return Intl.getCanonicalLocales(
    locales.flatMap(locale => {
      try {
        return Intl.getCanonicalLocales(locale);
      } catch {
        return 'en';
      }
    })
  );
}
