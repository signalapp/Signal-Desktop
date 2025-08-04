// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useMemo } from 'react';

import { computeBlurHashUrl } from '../util/computeBlurHashUrl';

export type Props = React.ImgHTMLAttributes<HTMLImageElement> &
  Readonly<{
    blurHash?: string;
    alt: string;
    intrinsicWidth?: number;
    intrinsicHeight?: number;
  }>;

export function ImageOrBlurhash({
  src: imageSrc,
  blurHash,
  alt,
  intrinsicWidth,
  intrinsicHeight,
  ...rest
}: Props): JSX.Element {
  const blurHashUrl = useMemo(() => {
    return blurHash
      ? computeBlurHashUrl(blurHash, intrinsicWidth, intrinsicHeight)
      : undefined;
  }, [blurHash, intrinsicWidth, intrinsicHeight]);

  const src = imageSrc ?? blurHashUrl;
  return (
    <img
      {...rest}
      src={src}
      alt={alt}
      style={{
        // Use a background image with an data url of the blurhash which should
        // show quickly and  stay visible until the img src is loaded/decoded.
        backgroundImage:
          blurHashUrl != null && blurHashUrl !== src
            ? `url(${blurHashUrl})`
            : 'none',

        // Preserve aspect ratio
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
      loading={blurHashUrl != null ? 'lazy' : 'eager'}
      decoding={blurHashUrl != null ? 'async' : 'auto'}
    />
  );
}
