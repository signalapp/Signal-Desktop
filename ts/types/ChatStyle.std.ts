// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Tagged } from 'type-fest';
import type { Uint32 } from '@signalapp/types';
import type { AxoColor } from '../axo/AxoColor.std.ts';
import { AxoTokens } from '../axo/AxoTokens.std.ts';

export const ConversationColors = [
  'ultramarine',
  'crimson',
  'vermilion',
  'burlap',
  'forest',
  'wintergreen',
  'teal',
  'blue',
  'indigo',
  'violet',
  'plum',
  'taupe',
  'steel',
  'ember',
  'midnight',
  'infrared',
  'lagoon',
  'fluorescent',
  'basil',
  'sublime',
  'sea',
  'tangerine',
] as const;

export type ChatStyle = Readonly<{
  bubbleColor:
    | {
        bubbleColorPreset: ChatStyle.BubbleColorPreset;
        customChatColorId?: never;
      }
    | {
        bubbleColorPreset?: never;
        customChatColorId: ChatStyle.CustomChatColorId;
      };
}>;

export namespace ChatStyle {
  export type Gradient = Readonly<{
    start: AxoColor.ARGBInt;
    end: AxoColor.ARGBInt;
    // Whole degrees in [0, 360), matching the backup proto
    angle: Uint32;
  }>;

  export type CustomChatColorId = Tagged<number, 'CustomChatColorId'>;

  export type CustomChatColor = Readonly<{
    id: CustomChatColorId;
    color:
      | { solid: AxoColor.ARGBInt; gradient?: never }
      | { solid?: never; gradient: Gradient };
  }>;

  export type BubbleColorPreset =
    | AxoTokens.ChatBubble.SolidPresetName
    | AxoTokens.ChatBubble.GradientPresetName;
}

export function isBubbleColorPreset(
  name: string
): name is ChatStyle.BubbleColorPreset {
  return (
    AxoTokens.ChatBubble.isSolidPresetName(name) ||
    AxoTokens.ChatBubble.isGradientPresetName(name)
  );
}

export const DEFAULT_BUBBLE_COLOR = {
  bubbleColorPreset: 'ultramarine',
} as const satisfies ChatStyle['bubbleColor'];

export type BubbleColorRenderData = Readonly<
  | {
      bubbleColorPreset: ChatStyle.BubbleColorPreset;
      customColor?: never;
    }
  | {
      bubbleColorPreset?: never;
      customColor: ChatStyle.CustomChatColor['color'];
    }
>;
