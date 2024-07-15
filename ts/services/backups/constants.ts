// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Backups } from '../../protobuf';
import type { ConversationColorType } from '../../types/Colors';

export const BACKUP_VERSION = 1;

const { WallpaperPreset } = Backups.ChatStyle;

// See https://github.com/signalapp/Signal-Android-Private/blob/4a41e9f9a1ed0aba7cae0e0dc4dbcac50fddc469/app/src/main/java/org/thoughtcrime/securesms/conversation/colors/ChatColorsMapper.kt#L32
export const WALLPAPER_TO_BUBBLE_COLOR = new Map<
  Backups.ChatStyle.WallpaperPreset,
  ConversationColorType
>([
  [WallpaperPreset.SOLID_BLUSH, 'crimson'],
  [WallpaperPreset.SOLID_COPPER, 'vermilion'],
  [WallpaperPreset.SOLID_DUST, 'burlap'],
  [WallpaperPreset.SOLID_CELADON, 'forest'],
  [WallpaperPreset.SOLID_RAINFOREST, 'wintergreen'],
  [WallpaperPreset.SOLID_PACIFIC, 'teal'],
  [WallpaperPreset.SOLID_FROST, 'blue'],
  [WallpaperPreset.SOLID_NAVY, 'indigo'],
  [WallpaperPreset.SOLID_LILAC, 'violet'],
  [WallpaperPreset.SOLID_PINK, 'plum'],
  [WallpaperPreset.SOLID_EGGPLANT, 'taupe'],
  [WallpaperPreset.SOLID_SILVER, 'steel'],
  [WallpaperPreset.GRADIENT_SUNSET, 'ember'],
  [WallpaperPreset.GRADIENT_NOIR, 'midnight'],
  [WallpaperPreset.GRADIENT_HEATMAP, 'infrared'],
  [WallpaperPreset.GRADIENT_AQUA, 'lagoon'],
  [WallpaperPreset.GRADIENT_IRIDESCENT, 'fluorescent'],
  [WallpaperPreset.GRADIENT_MONSTERA, 'basil'],
  [WallpaperPreset.GRADIENT_BLISS, 'sublime'],
  [WallpaperPreset.GRADIENT_SKY, 'sea'],
  [WallpaperPreset.GRADIENT_PEACH, 'tangerine'],
]);
