// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, {
  useState,
  useRef,
  useMemo,
  useCallback,
  useEffect,
  CSSProperties,
} from 'react';
import classNames from 'classnames';
import { noop } from 'lodash';
import { VideoFrameSource } from '../types/Calling';
import { CallBackgroundBlur } from './CallBackgroundBlur';

// The max size video frame we'll support (in RGBA)
const FRAME_BUFFER_SIZE = 1920 * 1080 * 4;

interface BasePropsType {
  demuxId: number;
  getGroupCallVideoFrameSource: (demuxId: number) => VideoFrameSource;
  hasRemoteAudio: boolean;
  hasRemoteVideo: boolean;
}

interface InPipPropsType {
  isInPip: true;
}

interface NotInPipPropsType {
  isInPip?: false;
  width: number;
  height: number;
  left: number;
  top: number;
}

type PropsType = BasePropsType & (InPipPropsType | NotInPipPropsType);

export const GroupCallRemoteParticipant: React.FC<PropsType> = props => {
  const {
    demuxId,
    getGroupCallVideoFrameSource,
    hasRemoteAudio,
    hasRemoteVideo,
  } = props;

  const [canvasStyles, setCanvasStyles] = useState<CSSProperties>({});

  const remoteVideoRef = useRef<HTMLCanvasElement | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const frameBufferRef = useRef<ArrayBuffer>(
    new ArrayBuffer(FRAME_BUFFER_SIZE)
  );

  const videoFrameSource = useMemo(
    () => getGroupCallVideoFrameSource(demuxId),
    [getGroupCallVideoFrameSource, demuxId]
  );

  const renderVideoFrame = useCallback(() => {
    const canvasEl = remoteVideoRef.current;
    if (!canvasEl) {
      return;
    }

    const context = canvasEl.getContext('2d');
    if (!context) {
      return;
    }

    const frameDimensions = videoFrameSource.receiveVideoFrame(
      frameBufferRef.current
    );
    if (!frameDimensions) {
      return;
    }

    const [frameWidth, frameHeight] = frameDimensions;
    canvasEl.width = frameWidth;
    canvasEl.height = frameHeight;

    context.putImageData(
      new ImageData(
        new Uint8ClampedArray(
          frameBufferRef.current,
          0,
          frameWidth * frameHeight * 4
        ),
        frameWidth,
        frameHeight
      ),
      0,
      0
    );

    // If our `width` and `height` props don't match the canvas's aspect ratio, we want to
    //   fill the container. This can happen when RingRTC gives us an inaccurate
    //   `videoAspectRatio`, or if the container is an unexpected size.
    if (frameWidth > frameHeight) {
      setCanvasStyles({ width: '100%' });
    } else {
      setCanvasStyles({ height: '100%' });
    }
  }, [videoFrameSource]);

  useEffect(() => {
    if (!hasRemoteVideo) {
      return noop;
    }

    const tick = () => {
      renderVideoFrame();
      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [hasRemoteVideo, renderVideoFrame, videoFrameSource]);

  let containerStyles: CSSProperties;

  // TypeScript isn't smart enough to know that `isInPip` by itself disambiguates the
  //   types, so we have to use `props.isInPip` instead.
  // eslint-disable-next-line react/destructuring-assignment
  if (props.isInPip) {
    containerStyles = canvasStyles;
  } else {
    const { top, left, width, height } = props;

    containerStyles = {
      height,
      left,
      position: 'absolute',
      top,
      width,
    };
  }

  return (
    <div
      className={classNames(
        'module-ongoing-call__group-call-remote-participant',
        {
          'module-ongoing-call__group-call-remote-participant--audio-muted': !hasRemoteAudio,
        }
      )}
      style={containerStyles}
    >
      {hasRemoteVideo ? (
        <canvas
          className="module-ongoing-call__group-call-remote-participant__remote-video"
          style={canvasStyles}
          ref={remoteVideoRef}
        />
      ) : (
        <CallBackgroundBlur>
          {/* TODO: Improve the styling here. See DESKTOP-894. */}
          <span />
        </CallBackgroundBlur>
      )}
    </div>
  );
};
