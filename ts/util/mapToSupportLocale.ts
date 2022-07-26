// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export type SupportLocaleType =
  | 'ar'
  | 'de'
  | 'en-us'
  | 'es'
  | 'fr'
  | 'it'
  | 'ja'
  | 'pl'
  | 'pt-br'
  | 'ru'
  | 'sq'
  | 'zh-tw';

// See https://source.chromium.org/chromium/chromium/src/+/main:ui/base/l10n/l10n_util.cc
export type ElectronLocaleType =
  | 'af'
  | 'ar'
  | 'bg'
  | 'bn'
  | 'ca'
  | 'cs'
  | 'cy'
  | 'da'
  | 'de'
  | 'de-AT'
  | 'de-CH'
  | 'de-DE'
  | 'de-LI'
  | 'el'
  | 'en'
  | 'en-AU'
  | 'en-CA'
  | 'en-GB'
  | 'en-GB-oxendict'
  | 'en-IN'
  | 'en-NZ'
  | 'en-US'
  | 'eo'
  | 'es'
  | 'es-419'
  | 'et'
  | 'eu'
  | 'fa'
  | 'fi'
  | 'fr'
  | 'fr-CA'
  | 'fr-CH'
  | 'fr-FR'
  | 'he'
  | 'hi'
  | 'hr'
  | 'hu'
  | 'id'
  | 'it'
  | 'it-CH'
  | 'it-IT'
  | 'ja'
  | 'km'
  | 'kn'
  | 'ko'
  | 'lt'
  | 'mk'
  | 'mr'
  | 'ms'
  | 'nb'
  | 'nl'
  | 'nn'
  | 'no'
  | 'pl'
  | 'pt-BR'
  | 'pt-PT'
  | 'ro'
  | 'ru'
  | 'sk'
  | 'sl'
  | 'sq'
  | 'sr'
  | 'sv'
  | 'sw'
  | 'ta'
  | 'te'
  | 'th'
  | 'tr'
  | 'uk'
  | 'ur'
  | 'vi'
  | 'zh-CN'
  | 'zh-HK'
  | 'zh-TW';

export function mapToSupportLocale(ourLocale: string): SupportLocaleType {
  if (ourLocale === 'ar') {
    return ourLocale;
  }
  if (ourLocale === 'de') {
    return ourLocale;
  }
  if (ourLocale === 'es') {
    return ourLocale;
  }
  if (ourLocale === 'fr') {
    return ourLocale;
  }
  if (ourLocale === 'it') {
    return ourLocale;
  }
  if (ourLocale === 'ja') {
    return ourLocale;
  }
  if (ourLocale === 'pl') {
    return ourLocale;
  }
  if (ourLocale === 'pt-BR') {
    return 'pt-br';
  }
  if (ourLocale === 'ru') {
    return ourLocale;
  }
  if (ourLocale === 'sq') {
    return ourLocale;
  }
  if (ourLocale === 'zh-TW') {
    return 'zh-tw';
  }

  return 'en-us';
}
