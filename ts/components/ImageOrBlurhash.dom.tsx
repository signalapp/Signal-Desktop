// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useMemo, useCallback, useState, useRef } from 'react';

import { computeBlurHashUrl } from '../util/computeBlurHashUrl.std.js';

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
  const ref = useRef<HTMLImageElement | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const blurHashUrl = useMemo(() => {
    return blurHash
      ? computeBlurHashUrl(blurHash, intrinsicWidth, intrinsicHeight)
      : undefined;
  }, [blurHash, intrinsicWidth, intrinsicHeight]);

  const onLoad = useCallback(() => {
    // Don't let background blurhash be visible at the same time as the image
    // while React propagates the `isLoaded` change.
    if (ref.current) {
      ref.current.style.backgroundImage = 'none';
    }
    setIsLoaded(true);
  }, [ref]);

  const src = imageSrc ?? blurHashUrl;
  return (
    <img
      {...rest}
      ref={ref}
      src={src}
      alt={alt}
      onLoad={onLoad}
      style={{
        // Use a background image with an data url of the blurhash which should
        // show quickly and  stay visible until the img src is loaded/decoded.
        backgroundImage:
          blurHashUrl != null && blurHashUrl !== src && !isLoaded
            ? `url(${blurHashUrl})`
            : 'none',
        aspectRatio:
          intrinsicWidth && intrinsicHeight
            ? `${intrinsicWidth} / ${intrinsicHeight}`
            : undefined,

        width: '100%',
        height: '100%',

        // Preserve aspect ratio
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
      loading={blurHashUrl != null ? 'lazy' : 'eager'}
    />
  );
}
