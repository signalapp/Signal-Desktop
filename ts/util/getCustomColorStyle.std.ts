// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { AxoColor } from '../axo/AxoColor.std.ts';
import { AxoTokens } from '../axo/AxoTokens.std.ts';
import type {
  BubbleColorRenderData,
  ChatStyle,
} from '../types/ChatStyle.std.ts';
import { DEFAULT_BUBBLE_COLOR } from '../types/ChatStyle.std.ts';

export function getCustomColorBackground(
  color: ChatStyle.CustomChatColor['color']
): string {
  if (color.solid != null) {
    return AxoColor.fromARGBInt(color.solid).css();
  }

  const gradient = color.gradient;
  const start = AxoColor.fromARGBInt(gradient.start).css();
  const end = AxoColor.fromARGBInt(gradient.end).css();
  const deg = 270 - gradient.angle;

  return `linear-gradient(${deg}deg, ${start}, ${end})`;
}

function findBubbleColorRenderData(
  bubbleColor: ChatStyle['bubbleColor'] | null | undefined,
  customChatColors: ReadonlyArray<ChatStyle.CustomChatColor>
): BubbleColorRenderData | null {
  if (bubbleColor == null) {
    return null;
  }

  if (bubbleColor.bubbleColorPreset != null) {
    return { bubbleColorPreset: bubbleColor.bubbleColorPreset };
  }

  const customChatColor = customChatColors.find(customColor => {
    return customColor.id === bubbleColor.customChatColorId;
  });
  if (customChatColor == null) {
    return null;
  }

  return { customColor: customChatColor.color };
}

export function resolveBubbleColorRenderData(
  bubbleColor: ChatStyle['bubbleColor'] | null | undefined,
  defaultBubbleColor: ChatStyle['bubbleColor'],
  customChatColors: ReadonlyArray<ChatStyle.CustomChatColor>
): BubbleColorRenderData {
  return (
    findBubbleColorRenderData(bubbleColor, customChatColors) ??
    findBubbleColorRenderData(defaultBubbleColor, customChatColors) ??
    DEFAULT_BUBBLE_COLOR
  );
}

export function getBubbleColorBackground(
  bubbleColor: ChatStyle['bubbleColor'] | null | undefined,
  defaultBubbleColor: ChatStyle['bubbleColor'],
  customChatColors: ReadonlyArray<ChatStyle.CustomChatColor>
): string {
  return getBubbleColorRenderDataBackground(
    resolveBubbleColorRenderData(
      bubbleColor,
      defaultBubbleColor,
      customChatColors
    )
  );
}

export function getBubbleColorRenderDataBackground(
  bubbleColor: BubbleColorRenderData
): string {
  if (bubbleColor.bubbleColorPreset != null) {
    return AxoTokens.ChatBubble.anyColorNameToCssBackground(
      bubbleColor.bubbleColorPreset
    );
  }

  return getCustomColorBackground(bubbleColor.customColor);
}
