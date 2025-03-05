// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { AvatarColors } from '../types/Colors';
import type { ConversationAttributesType } from '../model-types';
import type { AvatarColorType, CustomColorType } from '../types/Colors';
import { generateAvatarColor } from '../Crypto';

const NEW_COLOR_NAMES = new Set(AvatarColors);

export function migrateColor(
  color: string | undefined,
  options: Parameters<typeof generateAvatarColor>[0]
): AvatarColorType {
  if (color && NEW_COLOR_NAMES.has(color)) {
    return color;
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
