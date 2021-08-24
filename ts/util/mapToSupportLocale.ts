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
  | 'el'
  | 'en'
  | 'eo'
  | 'es'
  | 'es_419'
  | 'et'
  | 'eu'
  | 'fa'
  | 'fi'
  | 'fr'
  | 'he'
  | 'hi'
  | 'hr'
  | 'hu'
  | 'id'
  | 'it'
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
  | 'pt_BR'
  | 'pt_PT'
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
  | 'zh_CN'
  | 'zh_TW';

export function mapToSupportLocale(
  ourLocale: ElectronLocaleType
): SupportLocaleType {
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
  if (ourLocale === 'pt_BR') {
    return 'pt-br';
  }
  if (ourLocale === 'ru') {
    return ourLocale;
  }
  if (ourLocale === 'sq') {
    return ourLocale;
  }
  if (ourLocale === 'zh_TW') {
    return 'zh-tw';
  }

  return 'en-us';
}
