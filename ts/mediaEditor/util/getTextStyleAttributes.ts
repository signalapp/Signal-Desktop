// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../../logging/log';
import { getHSL } from './color';
import { missingCaseError } from '../../util/missingCaseError';

export enum TextStyle {
  Regular = 'Regular',
  Highlight = 'Highlight',
  Outline = 'Outline',
}

export function getTextStyleAttributes(
  textStyle: TextStyle,
  hueSliderValue: number
): {
  fill: string;
  stroke?: string;
  strokeWidth: number;
  textBackgroundColor: string;
} {
  const color = getHSL(hueSliderValue);
  switch (textStyle) {
    case TextStyle.Regular:
      return { fill: color, strokeWidth: 0, textBackgroundColor: '' };
    case TextStyle.Highlight:
      return {
        fill: hueSliderValue >= 95 ? '#000' : '#fff',
        strokeWidth: 0,
        textBackgroundColor: color,
      };
    case TextStyle.Outline:
      return {
        fill: hueSliderValue >= 95 ? '#000' : '#fff',
        stroke: color,
        strokeWidth: 2,
        textBackgroundColor: '',
      };
    default:
      log.error(missingCaseError(textStyle));
      return getTextStyleAttributes(TextStyle.Regular, hueSliderValue);
  }
}
