// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../../logging/log.std.js';
import { getHSL } from './color.std.js';
import { missingCaseError } from '../../util/missingCaseError.std.js';
import { toLogFormat } from '../../types/errors.std.js';

const log = createLogger('getTextStyleAttributes');

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
      log.error(toLogFormat(missingCaseError(textStyle)));
      return getTextStyleAttributes(TextStyle.Regular, hueSliderValue);
  }
}
