// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// We ["MUST NOT generate more than three digits after the decimal point"][0]. We use a
//   space-efficient algorithm that runs out of digits after 28 languages. This should be
//   fine for most users and [the server doesn't parse more than 15 languages, at least
//   in some cases][1].
//
// [0]: https://httpwg.org/specs/rfc7231.html#quality.values
// [1]: https://github.com/signalapp/Signal-Server/blob/bf6d3aa32407ff52b5547ed6ce2e7a2f2bbb0f03/service/src/main/java/org/signal/i18n/HeaderControlledResourceBundleLookup.java#L19

export function getUserLanguages(
  defaults: undefined | ReadonlyArray<string>,
  fallback: string
): ReadonlyArray<string> {
  const result = defaults || [];
  return result.length ? result : [fallback];
}
