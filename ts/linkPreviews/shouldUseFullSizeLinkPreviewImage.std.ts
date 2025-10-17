// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LinkPreviewType } from '../types/message/LinkPreviews.std.js';
import { isImageAttachment } from '../util/Attachment.std.js';

const MINIMUM_FULL_SIZE_DIMENSION = 200;

export function shouldUseFullSizeLinkPreviewImage({
  isStickerPack,
  image,
}: Readonly<LinkPreviewType>): boolean {
  if (isStickerPack || !image || !isImageAttachment(image)) {
    return false;
  }

  const { width, height } = image;

  return (
    isDimensionFullSize(width) &&
    isDimensionFullSize(height) &&
    !isRoughlySquare(width, height)
  );
}

function isDimensionFullSize(dimension: unknown): dimension is number {
  return (
    typeof dimension === 'number' && dimension >= MINIMUM_FULL_SIZE_DIMENSION
  );
}

function isRoughlySquare(width: number, height: number): boolean {
  return Math.abs(1 - width / height) < 0.05;
}
