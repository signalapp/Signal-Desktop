// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CustomColorType } from '../types/Colors.std.ts';
import { getHSL } from './getHSL.std.ts';

type BackgroundPropertyType =
  | { backgroundColor: string }
  | { backgroundImage: string };

export function getCustomColorStyle(
  color?: CustomColorType
): BackgroundPropertyType | undefined {
  if (!color) {
    return undefined;
  }

  if (!color.end) {
    return {
      backgroundColor: getHSL(color.start),
    };
  }

  const deg = 270 - (color.deg ?? 0);
  const start = getHSL(color.start);
  const end = getHSL(color.end);

  return {
    backgroundImage: `linear-gradient(${deg}deg, ${start}, ${end})`,
  };
}
