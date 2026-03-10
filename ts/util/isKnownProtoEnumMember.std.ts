// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function isKnownProtoEnumMember<E extends number>(
  enum_: Record<string | `${E}`, E | string>,
  value: unknown
): value is E {
  return typeof value === 'number' && Object.hasOwn(enum_, value);
}
