// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// the support only provides a subset of languages available within the app
// so we have to list them out here and fallback to english if not included
const SUPPORT_LANGUAGES = [
  'ar',
  'bn',
  'de',
  'en-us',
  'es',
  'fr',
  'hi',
  'hi-in',
  'hc',
  'id',
  'it',
  'ja',
  'ko',
  'mr',
  'ms',
  'nl',
  'pl',
  'pt',
  'ru',
  'sv',
  'ta',
  'te',
  'tr',
  'uk',
  'ur',
  'vi',
  'zh-cn',
  'zh-tw',
];

export type CreateSupportUrlOptionsType = Readonly<{
  locale: string;
  query?: Record<string, string>;
}>;

export function createSupportUrl({
  locale,
  query = {},
}: CreateSupportUrlOptionsType): string {
  const language = SUPPORT_LANGUAGES.includes(locale) ? locale : 'en-us';

  // This URL needs a hardcoded language because the '?desktop' is dropped if
  //   the page auto-redirects to the proper URL
  const url = new URL(`https://support.signal.org/hc/${language}/requests/new`);

  url.searchParams.set('desktop', '');

  for (const key of Object.keys(query)) {
    if (key === 'desktop') {
      continue;
    }
    url.searchParams.set(key, query[key]);
  }

  // Support page requires `?desktop&...` not `?desktop=&...`
  return url.toString().replace('desktop=', 'desktop');
}
