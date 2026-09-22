// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  useMemo,
  useCallback,
  useState,
  useRef,
  type ImgHTMLAttributes,
  type JSX,
} from 'react';

import { computeBlurHashUrl } from '../util/computeBlurHashUrl.std.ts';

export type Props = ImgHTMLAttributes<HTMLImageElement> &
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
  onError,
  ...rest
}: Props): JSX.Element {
  const ref = useRef<HTMLImageElement | null>(null);

  const [loadedSrc, setLoadedSrc] = useState<string | undefined>();
  const [erroredSrc, setErroredSrc] = useState<string | undefined>();

  const isLoaded = imageSrc && loadedSrc === imageSrc;
  const hasErrored = imageSrc && erroredSrc === imageSrc;

  const blurHashUrl = useMemo(() => {
    return blurHash
      ? computeBlurHashUrl(blurHash, intrinsicWidth, intrinsicHeight)
      : undefined;
  }, [blurHash, intrinsicWidth, intrinsicHeight]);

  const renderedSrc = hasErrored ? blurHashUrl : (imageSrc ?? blurHashUrl);

  const onLoad = useCallback(() => {
    // Don't let background blurhash be visible at the same time as the image
    // while React propagates the `isLoaded` change.
    if (ref.current && renderedSrc === imageSrc) {
      ref.current.style.backgroundImage = 'none';
    }
    setLoadedSrc(renderedSrc);
  }, [ref, imageSrc, renderedSrc]);

  return (
    <img
      {...rest}
      ref={ref}
      src={renderedSrc}
      alt={alt}
      onLoad={onLoad}
      data-loaded={isLoaded}
      style={{
        // Use a background image with an data url of the blurhash which should
        // show quickly and  stay visible until the img src is loaded/decoded.
        backgroundImage:
          blurHashUrl != null && !isLoaded ? `url(${blurHashUrl})` : 'none',
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
      onError={ev => {
        setErroredSrc(imageSrc);
        onError?.(ev);
      }}
    />
  );
}
