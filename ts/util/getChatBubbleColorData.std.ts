// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { AxoColor } from '../axo/AxoColor.std.ts';
import { AxoTokens } from '../axo/AxoTokens.std.ts';
import type { BubbleColorRenderData } from '../types/ChatStyle.std.ts';

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
  bubbleColor: BubbleColorRenderData
): SolidData | GradientData | null {
  if (bubbleColor.bubbleColorPreset != null) {
    const preset = bubbleColor.bubbleColorPreset;

    if (AxoTokens.ChatBubble.isSolidPresetName(preset)) {
      return toSolidData(AxoTokens.ChatBubble.getSolidPresetValue(preset));
    }

    return toGradientData(AxoTokens.ChatBubble.getGradientPresetValues(preset));
  }

  const { customColor } = bubbleColor;

  if (customColor.solid != null) {
    return toSolidData(AxoColor.fromARGBInt(customColor.solid).css());
  }

  const { gradient } = customColor;

  return toGradientData({
    deg: 270 - gradient.angle,
    start: AxoColor.fromARGBInt(gradient.start).css(),
    end: AxoColor.fromARGBInt(gradient.end).css(),
  });
}
