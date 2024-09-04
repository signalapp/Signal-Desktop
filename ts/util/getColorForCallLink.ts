// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { AVATAR_COLOR_COUNT, AvatarColors } from '../types/Colors';

// See https://github.com/signalapp/ringrtc/blob/49b4b8a16f997c7fa9a429e96aa83f80b2065c63/src/rust/src/lite/call_links/base16.rs#L8
const BASE_16_CONSONANT_ALPHABET = 'bcdfghkmnpqrstxz';

// See https://github.com/signalapp/ringrtc/blob/49b4b8a16f997c7fa9a429e96aa83f80b2065c63/src/rust/src/lite/call_links/base16.rs#L127-L139
export function getColorForCallLink(rootKey: string): string {
  const rootKeyStart = rootKey.slice(0, 2);

  const upper = (BASE_16_CONSONANT_ALPHABET.indexOf(rootKeyStart[0]) || 0) * 16;
  const lower = BASE_16_CONSONANT_ALPHABET.indexOf(rootKeyStart[1]) || 0;
  const firstByte = upper + lower;

  const index = firstByte % AVATAR_COLOR_COUNT;

  return AvatarColors[index];
}
