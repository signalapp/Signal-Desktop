// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { CSSProperties, ForwardedRef } from 'react';
import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@react-spring/web';
import { SpinnerV2 } from '../SpinnerV2.dom.js';
import { strictAssert } from '../../util/assert.std.js';
import type { Loadable } from '../../util/loadable.std.js';
import { LoadingState } from '../../util/loadable.std.js';
import { useIntent } from './base/FunImage.dom.js';
import { createLogger } from '../../logging/log.std.js';
import * as Errors from '../../types/errors.std.js';
import { isAbortError } from '../../util/isAbortError.std.js';

const log = createLogger('FunGif');

export type FunGifProps = Readonly<{
  src: string;
  width: number;
  height: number;
  'aria-label'?: string;
  'aria-describedby': string;
  ignoreReducedMotion?: boolean;
}>;

export function FunGif(props: FunGifProps): JSX.Element {
  if (props.ignoreReducedMotion) {
    return <FunGifBase {...props} autoPlay />;
  }
  return <FunGifReducedMotion {...props} />;
}

/** @internal */
const FunGifBase = forwardRef(function FunGifBase(
  props: FunGifProps & { autoPlay: boolean },
  ref: ForwardedRef<HTMLVideoElement>
) {
  return (
    <video
      ref={ref}
      className="FunGif"
      src={props.src}
      width={props.width}
      height={props.height}
      loop
      autoPlay={props.autoPlay}
      playsInline
      muted
      disablePictureInPicture
      disableRemotePlayback
      aria-label={props['aria-label']}
      aria-describedby={props['aria-describedby']}
    />
  );
});

/** @internal */
function FunGifReducedMotion(props: FunGifProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const intent = useIntent(videoRef);
  const reducedMotion = useReducedMotion();
  const shouldPlay = !reducedMotion || intent;

  useEffect(() => {
    strictAssert(videoRef.current, 'Expected video element');
    const video = videoRef.current;
    if (shouldPlay) {
      video.play().catch(error => {
        // ignore errors where `play()` was interrupted by `pause()`
        if (!isAbortError(error)) {
          log.error('Playback error', Errors.toLogFormat(error));
        }
      });
    } else {
      video.pause();
    }
  }, [shouldPlay]);

  return <FunGifBase {...props} ref={videoRef} autoPlay={shouldPlay} />;
}

export type FunGifPreviewLoadable = Loadable<string>;

export type FunGifPreviewProps = Readonly<{
  src: string | null;
  state: LoadingState;
  width: number;
  height: number;
  // It would be nice if this were determined by the container, but that's a
  // difficult problem because it creates a cycle where the parent's height
  // depends on its children, and its children's height depends on its parent.
  // As far as I was able to figure out, this could only be done in one dimension
  // at a time.
  maxHeight: number;
  'aria-label'?: string;
  'aria-describedby': string;
}>;

export function FunGifPreview(props: FunGifPreviewProps): JSX.Element {
  const ref = useRef<HTMLVideoElement>(null);
  const [spinner, setSpinner] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const timer = setTimeout(() => {
      setSpinner(true);
    });
    timerRef.current = timer;
    return () => {
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (props.src == null) {
      return;
    }
    strictAssert(ref.current != null, 'video ref should not be null');
    const video = ref.current;
    function onCanPlay() {
      video.hidden = false;
      clearTimeout(timerRef.current);
      setSpinner(false);
      setPlaybackError(false);
    }
    function onError() {
      clearTimeout(timerRef.current);
      setSpinner(false);
      setPlaybackError(true);
    }
    video.addEventListener('canplay', onCanPlay, { once: true });
    video.addEventListener('error', onError, { once: true });
    return () => {
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('error', onError);
    };
  }, [props.src]);

  const hasError = props.state === LoadingState.LoadFailed || playbackError;

  return (
    <div className="FunGifPreview">
      <svg
        aria-hidden
        className="FunGifPreview__Sizer"
        width={props.width}
        height={props.height}
        style={
          {
            '--fun-gif-preview-sizer-max-height': `${props.maxHeight}px`,
          } as CSSProperties
        }
      />
      <div className="FunGifPreview__Backdrop" role="status">
        {spinner && !hasError && <SpinnerV2 size={36} strokeWidth={2} />}
        {hasError && <div className="FunGifPreview__ErrorIcon" />}
      </div>
      {props.src != null && (
        <video
          ref={ref}
          className="FunGifPreview__Video"
          src={props.src}
          width={props.width}
          height={props.height}
          loop
          autoPlay
          playsInline
          muted
          disablePictureInPicture
          disableRemotePlayback
          aria-label={props['aria-label']}
          aria-describedby={props['aria-describedby']}
        />
      )}
    </div>
  );
}
