// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function normalizeProfileName(
  profileName: string | undefined
): string | undefined {
  return profileName?.trim() || undefined;
}
