// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { RefObject } from 'react';
import React, { useRef, useEffect, useState } from 'react';
import classNames from 'classnames';
import { isFocusable } from '@react-aria/focus';
import { strictAssert } from '../../../util/assert';
import { useReducedMotion } from '../../../hooks/useReducedMotion';

export type FunAnimatedImageProps = Readonly<{
  role: 'image' | 'presentation';
  className?: string;
  src: string;
  width: number;
  height: number;
  alt: string;
}>;

export function FunImage(props: FunAnimatedImageProps): JSX.Element {
  const imageRef = useRef<HTMLImageElement>(null);
  const intent = useIntent(imageRef);
  const [staticSource, setStaticSource] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    // Don't bother creating the static source if we're not in reduced motion
    if (!reducedMotion) {
      return;
    }

    strictAssert(imageRef.current, 'Expected imageRef to be set');
    const image = imageRef.current;
    const controller = new AbortController();
    const { signal } = controller;

    async function onLoad() {
      const blob = await createStaticImageBlob(image, signal);
      const url = URL.createObjectURL(blob);
      setStaticSource(url);
    }

    image.addEventListener('load', onLoad, { once: true, signal });
    return () => {
      controller.abort();
      image.removeEventListener('load', onLoad);
    };
  }, [props.src, reducedMotion]);

  // Ensure we always revoke the object URL.
  useEffect(() => {
    return () => {
      if (staticSource != null) {
        URL.revokeObjectURL(staticSource);
      }
    };
  }, [staticSource]);

  return (
    <picture
      // This element renders as `display: contents` so the <img/> tag is
      // always responsible for the layout/styles, this makes it a very good
      // drop-in for a plain <img/> tag
      className={classNames('FunImage', {
        // Only hide the image if we're in reduced motion mode and
        // we haven't loaded the static source yet.
        'FunImage--Hidden': reducedMotion && staticSource == null,
      })}
    >
      {staticSource != null && reducedMotion && !intent && (
        <source className="FunImage--StaticSource" srcSet={staticSource} />
      )}
      {/* Using <img> to benefit from browser */}
      <img
        ref={imageRef}
        role={props.role}
        className={props.className}
        src={props.src}
        width={props.width}
        height={props.height}
        alt={props.alt}
      />
    </picture>
  );
}

/** Similar to `element.closest()` but with a predicate instead of selectors */
function closestElement(
  element: HTMLElement,
  predicate: (element: HTMLElement) => boolean
): HTMLElement | null {
  let search: HTMLElement | null = element;
  while (search != null) {
    if (predicate(search)) {
      return search;
    }
    search = search.parentElement;
  }
  return null;
}

/**
 * Tracks the closest focusable ancestor for user "intent" (focus/hover within).
 *
 * - Uses the nearest "focusable" element, even if it is not "tabbable", so it
 *   should not be affected by `tabIndex` or `disabled` attributes.
 * - React doesn't support "reparenting" so we don't need to worry about the
 *   ancestors changing on us.
 * - However, this will break if elements become focusable/unfocusable during
 *   their lifetime (this is generally a sign something is being done wrong).
 */
function useIntent(ref: RefObject<HTMLElement>): boolean {
  const [intent, setIntent] = useState(false);

  useEffect(() => {
    strictAssert(ref.current, 'Expected ref to be set');
    const target = ref.current;
    const focusable = closestElement(target, isFocusable);
    strictAssert(focusable, 'Expected focusable ancestor to be found');

    function onIntent() {
      setIntent(true);
    }

    function onDetent() {
      setIntent(false);
    }

    focusable.addEventListener('focusin', onIntent);
    focusable.addEventListener('mouseenter', onIntent);
    focusable.addEventListener('focusout', onDetent);
    focusable.addEventListener('mouseleave', onDetent);

    return () => {
      focusable.removeEventListener('focusin', onIntent);
      focusable.removeEventListener('mouseenter', onIntent);
      focusable.removeEventListener('focusout', onDetent);
      focusable.removeEventListener('mouseleave', onDetent);
    };
  }, [ref]);

  return intent;
}

/**
 * Given any <img>, bitmap, blob, etc. create a static image blob even if it's
 * animated.
 */
async function createStaticImageBlob(
  image: ImageBitmapSource,
  signal: AbortSignal
): Promise<Blob> {
  const bitmap = await createImageBitmap(image);
  signal.throwIfAborted();
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext('bitmaprenderer');
  strictAssert(context, 'Failed to load bitmaprenderer context');
  context.transferFromImageBitmap(bitmap);
  const blob = await canvas.convertToBlob();
  signal.throwIfAborted();
  return blob;
}
