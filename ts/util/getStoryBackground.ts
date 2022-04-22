// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentType, TextAttachmentType } from '../types/Attachment';

const COLOR_BLACK_ALPHA_90 = 'rgba(0, 0, 0, 0.9)';
const COLOR_WHITE_INT = 4294704123;

export function getHexFromNumber(color: number): string {
  return `#${color.toString(16).slice(2)}`;
}

export function getBackgroundColor({
  color,
  gradient,
}: TextAttachmentType): string {
  if (gradient) {
    return `linear-gradient(${gradient.angle}deg, ${getHexFromNumber(
      gradient.startColor || COLOR_WHITE_INT
    )}, ${getHexFromNumber(gradient.endColor || COLOR_WHITE_INT)})`;
  }

  return getHexFromNumber(color || COLOR_WHITE_INT);
}

export function getStoryBackground(attachment?: AttachmentType): string {
  if (!attachment) {
    return COLOR_BLACK_ALPHA_90;
  }

  if (attachment.textAttachment) {
    return getBackgroundColor(attachment.textAttachment);
  }

  if (attachment.url) {
    return `url("${attachment.url}")`;
  }

  return COLOR_BLACK_ALPHA_90;
}
