// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.std.ts';
import type { ChatStyle } from '../types/ChatStyle.std.ts';

export type ConversationBubbleColorAttributes = Pick<
  ConversationAttributesType,
  'bubbleColorPreset' | 'customChatColorId'
>;

export function getConversationBubbleColor(
  attributes: ConversationBubbleColorAttributes
): ChatStyle['bubbleColor'] | null {
  if (attributes.customChatColorId != null) {
    return { customChatColorId: attributes.customChatColorId };
  }
  if (attributes.bubbleColorPreset != null) {
    return { bubbleColorPreset: attributes.bubbleColorPreset };
  }
  return null;
}

export function toConversationBubbleColorAttributes(
  bubbleColor: ChatStyle['bubbleColor'] | null | undefined
): ConversationBubbleColorAttributes {
  return {
    bubbleColorPreset: bubbleColor?.bubbleColorPreset ?? undefined,
    customChatColorId: bubbleColor?.customChatColorId ?? undefined,
  };
}
