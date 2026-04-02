// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function isKnownProtoEnumMember<E extends number>(
  // oxlint-disable-next-line typescript/no-redundant-type-constituents
  enum_: Record<string | `${E}`, E | string>,
  value: unknown
): value is E {
  return typeof value === 'number' && Object.hasOwn(enum_, value);
}
