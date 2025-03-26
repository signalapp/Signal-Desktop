// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react';
import { FunImage } from './base/FunImage';
import type { FunImageAriaProps } from './types';

export type FunStickerProps = FunImageAriaProps &
  Readonly<{
    src: string;
    size: number;
    ignoreReducedMotion?: boolean;
  }>;

export function FunSticker(props: FunStickerProps): JSX.Element {
  const { src, size, ignoreReducedMotion, ...ariaProps } = props;
  return (
    <FunImage
      {...ariaProps}
      className="FunItem__Sticker"
      src={src}
      width={size}
      height={size}
      ignoreReducedMotion={ignoreReducedMotion}
    />
  );
}
