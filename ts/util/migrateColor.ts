// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { AvatarColors } from '../types/Colors.std.js';
import type { ConversationAttributesType } from '../model-types.d.ts';
import type { AvatarColorType, CustomColorType } from '../types/Colors.std.js';
import { generateAvatarColor } from '../Crypto.node.js';

const NEW_COLOR_NAMES = new Set(AvatarColors);

export function migrateColor(
  color: string | undefined,
  options: Parameters<typeof generateAvatarColor>[0]
): AvatarColorType {
  if (color && NEW_COLOR_NAMES.has(color as AvatarColorType)) {
    return color as AvatarColorType;
  }

  return generateAvatarColor(options);
}

export function getCustomColorData(conversation: ConversationAttributesType): {
  customColor?: CustomColorType;
  customColorId?: string;
} {
  if (conversation.conversationColor !== 'custom') {
    return {
      customColor: undefined,
      customColorId: undefined,
    };
  }

  return {
    customColor: conversation.customColor,
    customColorId: conversation.customColorId,
  };
}
