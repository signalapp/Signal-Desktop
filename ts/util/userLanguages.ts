// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// We ["MUST NOT generate more than three digits after the decimal point"][0]. We use a
//   space-efficient algorithm that runs out of digits after 28 languages. This should be
//   fine for most users and [the server doesn't parse more than 15 languages, at least
//   in some cases][1].
//
// [0]: https://httpwg.org/specs/rfc7231.html#quality.values
// [1]: https://github.com/signalapp/Signal-Server/blob/bf6d3aa32407ff52b5547ed6ce2e7a2f2bbb0f03/service/src/main/java/org/signal/i18n/HeaderControlledResourceBundleLookup.java#L19
const MAX_LANGUAGES_TO_FORMAT = 28;

export function formatAcceptLanguageHeader(
  languages: ReadonlyArray<string>
): string {
  if (languages.length === 0) {
    return '*';
  }

  const result: Array<string> = [];

  const length = Math.min(languages.length, MAX_LANGUAGES_TO_FORMAT);
  for (let i = 0; i < length; i += 1) {
    const language = languages[i];

    // ["If no 'q' parameter is present, the default weight is 1."][1]
    //
    // [1]: https://httpwg.org/specs/rfc7231.html#quality.values
    if (i === 0) {
      result.push(language);
      continue;
    }

    // These values compute a descending sequence with minimal bytes. See the tests for
    //   examples.
    const magnitude = 1 / 10 ** (Math.ceil(i / 9) - 1);
    const subtractor = (((i - 1) % 9) + 1) * (magnitude / 10);
    const q = magnitude - subtractor;
    const formattedQ = q.toFixed(3).replace(/0+$/, '');

    result.push(`${language};q=${formattedQ}`);
  }

  return result.join(', ');
}

export function getUserLanguages(
  defaults: undefined | ReadonlyArray<string>,
  fallback: string
): ReadonlyArray<string> {
  const result = defaults || [];
  return result.length ? result : [fallback];
}
