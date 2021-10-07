// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Returns `true` if the input looks like a valid E164, and `false` otherwise. Note that
 * this may return false positives, as it is a fairly naïve check.
 *
 * See <https://www.twilio.com/docs/glossary/what-e164#regex-matching-for-e164> and
 * <https://stackoverflow.com/a/23299989>.
 */
export function isValidE164(
  value: unknown,
  mustStartWithPlus: boolean
): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  const regex = mustStartWithPlus ? /^\+[1-9]\d{1,14}$/ : /^\+?[1-9]\d{1,14}$/;

  return regex.test(value);
}
