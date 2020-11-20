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
import {
  GroupCallRemoteParticipantType,
  VideoFrameSource,
} from '../types/Calling';
import { LocalizerType } from '../types/Util';
import { CallBackgroundBlur } from './CallBackgroundBlur';
import { Avatar, AvatarSize } from './Avatar';
import { ContactName } from './conversation/ContactName';

// The max size video frame we'll support (in RGBA)
const FRAME_BUFFER_SIZE = 1920 * 1080 * 4;

interface BasePropsType {
  getGroupCallVideoFrameSource: (demuxId: number) => VideoFrameSource;
  i18n: LocalizerType;
  remoteParticipant: GroupCallRemoteParticipantType;
}

interface InPipPropsType {
  isInPip: true;
}

interface NotInPipPropsType {
  height: number;
  isInPip?: false;
  left: number;
  top: number;
  width: number;
}

export type PropsType = BasePropsType & (InPipPropsType | NotInPipPropsType);

export const GroupCallRemoteParticipant: React.FC<PropsType> = React.memo(
  props => {
    const { getGroupCallVideoFrameSource } = props;

    const {
      avatarPath,
      color,
      profileName,
      title,
      demuxId,
      hasRemoteAudio,
      hasRemoteVideo,
    } = props.remoteParticipant;

    const [isWide, setIsWide] = useState(true);
    const [hasHover, setHover] = useState(false);

    const remoteVideoRef = useRef<HTMLCanvasElement | null>(null);
    const canvasContextRef = useRef<CanvasRenderingContext2D | null>(null);
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

      const canvasContext = canvasContextRef.current;
      if (!canvasContext) {
        return;
      }

      const frameDimensions = videoFrameSource.receiveVideoFrame(
        frameBufferRef.current
      );
      if (!frameDimensions) {
        return;
      }

      const [frameWidth, frameHeight] = frameDimensions;
      if (frameWidth < 2 || frameHeight < 2) {
        return;
      }

      canvasEl.width = frameWidth;
      canvasEl.height = frameHeight;

      canvasContext.putImageData(
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

      setIsWide(frameWidth > frameHeight);
    }, [videoFrameSource]);

    useEffect(() => {
      if (!hasRemoteVideo) {
        return noop;
      }

      let rafId = requestAnimationFrame(tick);

      function tick() {
        renderVideoFrame();
        rafId = requestAnimationFrame(tick);
      }

      return () => {
        cancelAnimationFrame(rafId);
      };
    }, [hasRemoteVideo, renderVideoFrame, videoFrameSource]);

    let canvasStyles: CSSProperties;
    let containerStyles: CSSProperties;

    // If our `width` and `height` props don't match the canvas's aspect ratio, we want to
    //   fill the container. This can happen when RingRTC gives us an inaccurate
    //   `videoAspectRatio`, or if the container is an unexpected size.
    if (isWide) {
      canvasStyles = { width: '100%' };
    } else {
      canvasStyles = { height: '100%' };
    }

    let avatarSize: number;

    // TypeScript isn't smart enough to know that `isInPip` by itself disambiguates the
    //   types, so we have to use `props.isInPip` instead.
    // eslint-disable-next-line react/destructuring-assignment
    if (props.isInPip) {
      containerStyles = canvasStyles;
      avatarSize = AvatarSize.FIFTY_TWO;
    } else {
      const { top, left, width, height } = props;
      const shorterDimension = Math.min(width, height);

      if (shorterDimension >= 240) {
        avatarSize = AvatarSize.ONE_HUNDRED_TWELVE;
      } else if (shorterDimension >= 180) {
        avatarSize = AvatarSize.EIGHTY;
      } else {
        avatarSize = AvatarSize.FIFTY_TWO;
      }

      containerStyles = {
        height,
        left,
        position: 'absolute',
        top,
        width,
      };
    }

    const showHover = hasHover && !props.isInPip;

    return (
      <div
        className="module-ongoing-call__group-call-remote-participant"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={containerStyles}
      >
        {showHover && (
          <div
            className={classNames(
              'module-ongoing-call__group-call-remote-participant--title',
              {
                'module-ongoing-call__group-call-remote-participant--audio-muted': !hasRemoteAudio,
              }
            )}
          >
            <ContactName
              module="module-ongoing-call__group-call-remote-participant--contact-name"
              profileName={profileName}
              title={title}
              i18n={props.i18n}
            />
          </div>
        )}
        {hasRemoteVideo ? (
          <canvas
            className="module-ongoing-call__group-call-remote-participant__remote-video"
            style={canvasStyles}
            ref={canvasEl => {
              remoteVideoRef.current = canvasEl;
              if (canvasEl) {
                canvasContextRef.current = canvasEl.getContext('2d', {
                  alpha: false,
                  desynchronized: true,
                  storage: 'discardable',
                } as CanvasRenderingContext2DSettings);
              } else {
                canvasContextRef.current = null;
              }
            }}
          />
        ) : (
          <CallBackgroundBlur avatarPath={avatarPath} color={color}>
            <Avatar
              avatarPath={avatarPath}
              color={color || 'ultramarine'}
              noteToSelf={false}
              conversationType="direct"
              i18n={props.i18n}
              profileName={profileName}
              title={title}
              size={avatarSize}
            />
          </CallBackgroundBlur>
        )}
      </div>
    );
  }
);
