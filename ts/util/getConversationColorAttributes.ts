// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationColorType, CustomColorType } from '../types/Colors';
import type { ConversationType } from '../state/ducks/conversations';

export function getConversationColorAttributes(
  conversationColors: Pick<
    ConversationType,
    'conversationColor' | 'customColorId' | 'customColor'
  >
): {
  conversationColor: ConversationColorType;
  customColor: CustomColorType | undefined;
  customColorId: string | undefined;
} {
  const defaultConversationColor = window.Events.getDefaultConversationColor();

  const conversationColor =
    conversationColors.conversationColor || defaultConversationColor.color;
  const customColor =
    conversationColor !== 'custom'
      ? undefined
      : conversationColors.customColor ||
        defaultConversationColor.customColorData?.value;
  const customColorId =
    conversationColor !== 'custom'
      ? undefined
      : conversationColors.customColorId ||
        defaultConversationColor.customColorData?.id;

  return {
    conversationColor,
    customColor,
    customColorId,
  };
}
