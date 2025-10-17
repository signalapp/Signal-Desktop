// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react';
import { FunImage } from './base/FunImage.dom.js';
import type { FunImageAriaProps } from './types.dom.js';

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
      className="FunSticker"
      src={src}
      width={size}
      height={size}
      ignoreReducedMotion={ignoreReducedMotion}
    />
  );
}
