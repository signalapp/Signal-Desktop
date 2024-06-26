// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { sample } from 'lodash';

import { AVATAR_COLOR_COUNT, AvatarColors } from '../types/Colors';
import type { ConversationAttributesType } from '../model-types';
import type { AvatarColorType, CustomColorType } from '../types/Colors';
import type { ServiceIdString } from '../types/ServiceId';

const NEW_COLOR_NAMES = new Set(AvatarColors);

export function migrateColor(
  serviceId?: ServiceIdString,
  color?: string
): AvatarColorType {
  if (color && NEW_COLOR_NAMES.has(color)) {
    return color;
  }

  if (!serviceId) {
    return sample(AvatarColors) || AvatarColors[0];
  }

  const index = (parseInt(serviceId.slice(-4), 16) || 0) % AVATAR_COLOR_COUNT;
  return AvatarColors[index];
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
