// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function isUnsupported(): boolean {
  const subtle = window.crypto?.subtle;
  if (!subtle) {
    return true;
  }
  if (
    !subtle.importKey ||
    !subtle.deriveBits ||
    !subtle.sign ||
    !subtle.encrypt
  ) {
    return true;
  }
  if (!window.crypto.getRandomValues) {
    return true;
  }
  return false;
}
