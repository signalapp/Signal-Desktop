// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  ConversationColorType,
  CustomColorType,
  DefaultConversationColorType,
} from '../types/Colors.std.js';
import type { ConversationType } from '../state/ducks/conversations.preload.js';

export function getConversationColorAttributes(
  conversationColors: Pick<
    ConversationType,
    'conversationColor' | 'customColorId' | 'customColor'
  >,
  defaultConversationColor: DefaultConversationColorType
): {
  conversationColor: ConversationColorType;
  customColor: CustomColorType | undefined;
  customColorId: string | undefined;
} {
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
