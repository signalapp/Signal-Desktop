// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { AxoTokens } from '../axo/AxoTokens.std.ts';
import type {
  ConversationColorType,
  CustomColorType,
} from '../types/Colors.std.ts';
import { getHSL } from './getHSL.std.ts';

type SolidData = Readonly<{
  kind: 'solid';
  value: string;
}>;

function toSolidData(value: string): SolidData {
  return { kind: 'solid', value };
}

type Gradient = Readonly<{
  deg: number;
  start: string;
  end: string;
}>;

type GradientData = Readonly<{
  kind: 'gradient';
  value: Gradient;
}>;

function toGradientData(value: Gradient): GradientData {
  return { kind: 'gradient', value };
}

export function getChatBubbleColorData(
  conversationColor: ConversationColorType,
  customColor: CustomColorType | null
): SolidData | GradientData | null {
  if (customColor?.end != null) {
    return toGradientData({
      deg: 270 - (customColor.deg ?? 0),
      start: getHSL(customColor.start),
      end: getHSL(customColor.end),
    });
  }

  if (customColor != null) {
    return toSolidData(getHSL(customColor.start));
  }

  if (AxoTokens.ChatBubble.isSolidPresetName(conversationColor)) {
    return toSolidData(
      AxoTokens.ChatBubble.getSolidPresetValue(conversationColor)
    );
  }

  if (AxoTokens.ChatBubble.isGradientPresetName(conversationColor)) {
    return toGradientData(
      AxoTokens.ChatBubble.getGradientPresetValues(conversationColor)
    );
  }

  return null;
}
