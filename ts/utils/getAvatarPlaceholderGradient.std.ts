// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { AxoTokens } from '../axo/AxoTokens.std.js';

export function getAvatarPlaceholderGradient(
  identifierHash: number
): Readonly<[string, string]> {
  const gradient = AxoTokens.Avatar.getGradientValuesByHash(identifierHash);
  return [gradient.start, gradient.end];
}
