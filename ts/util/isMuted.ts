// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function isMuted(
  muteExpiresAt: undefined | number
): muteExpiresAt is number {
  return Boolean(muteExpiresAt && Date.now() < muteExpiresAt);
}
