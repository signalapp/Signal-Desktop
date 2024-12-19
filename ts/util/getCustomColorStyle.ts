// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CustomColorType } from '../types/Colors';
import { ThemeType } from '../types/Util';
import { getHSL } from './getHSL';
import { getUserTheme } from '../shims/getUserTheme';

type ExtraQuotePropsType = {
  borderInlineStartColor?: string;
};

type BackgroundPropertyType =
  | { backgroundColor: string }
  | { backgroundImage: string }
  | undefined;

export function getCustomColorStyle(
  color?: CustomColorType,
  isQuote = false
): (BackgroundPropertyType & ExtraQuotePropsType) | undefined {
  if (!color) {
    return undefined;
  }

  const extraQuoteProps: ExtraQuotePropsType = {};
  let adjustedLightness = 0;
  if (isQuote) {
    const theme = getUserTheme();
    if (theme === ThemeType.light) {
      adjustedLightness = 0.6;
    }
    if (theme === ThemeType.dark) {
      adjustedLightness = -0.4;
    }
    extraQuoteProps.borderInlineStartColor = getHSL(color.start);
  }

  if (!color.end) {
    return {
      ...extraQuoteProps,
      backgroundColor: getHSL(color.start, adjustedLightness),
    };
  }

  return {
    ...extraQuoteProps,
    backgroundImage: `linear-gradient(${270 - (color.deg || 0)}deg, ${getHSL(
      color.start,
      adjustedLightness
    )}, ${getHSL(color.end, adjustedLightness)})`,
  };
}
