// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CSSProperties } from 'react';
import React, {
  useState,
  useRef,
  useMemo,
  useCallback,
  useEffect,
} from 'react';
import classNames from 'classnames';
import { noop } from 'lodash';
import type { VideoFrameSource } from 'ringrtc';
import type { GroupCallRemoteParticipantType } from '../types/Calling';
import type { LocalizerType } from '../types/Util';
import { AvatarColors } from '../types/Colors';
import { CallBackgroundBlur } from './CallBackgroundBlur';
import { CallingAudioIndicator } from './CallingAudioIndicator';
import { Avatar, AvatarSize } from './Avatar';
import { ConfirmationDialog } from './ConfirmationDialog';
import { Intl } from './Intl';
import { ContactName } from './conversation/ContactName';
import { useIntersectionObserver } from '../hooks/useIntersectionObserver';
import { MAX_FRAME_HEIGHT, MAX_FRAME_WIDTH } from '../calling/constants';

const MAX_TIME_TO_SHOW_STALE_VIDEO_FRAMES = 5000;
const MAX_TIME_TO_SHOW_STALE_SCREENSHARE_FRAMES = 60000;

type BasePropsType = {
  getFrameBuffer: () => Buffer;
  getGroupCallVideoFrameSource: (demuxId: number) => VideoFrameSource;
  i18n: LocalizerType;
  onVisibilityChanged?: (demuxId: number, isVisible: boolean) => unknown;
  remoteParticipant: GroupCallRemoteParticipantType;
};

type InPipPropsType = {
  isInPip: true;
};

type InOverflowAreaPropsType = {
  height: number;
  isInPip?: false;
  audioLevel: number;
  width: number;
};

type InGridPropsType = InOverflowAreaPropsType & {
  left: number;
  top: number;
};

export type PropsType = BasePropsType &
  (InPipPropsType | InOverflowAreaPropsType | InGridPropsType);

export const GroupCallRemoteParticipant: React.FC<PropsType> = React.memo(
  props => {
    const {
      getFrameBuffer,
      getGroupCallVideoFrameSource,
      i18n,
      onVisibilityChanged,
    } = props;

    const {
      acceptedMessageRequest,
      avatarPath,
      color,
      demuxId,
      hasRemoteAudio,
      hasRemoteVideo,
      isBlocked,
      isMe,
      profileName,
      sharedGroupNames,
      sharingScreen,
      title,
      videoAspectRatio,
    } = props.remoteParticipant;

    const [hasReceivedVideoRecently, setHasReceivedVideoRecently] =
      useState(false);
    const [isWide, setIsWide] = useState<boolean>(
      videoAspectRatio ? videoAspectRatio >= 1 : true
    );
    const [showBlockInfo, setShowBlockInfo] = useState(false);

    // We have some state (`hasReceivedVideoRecently`) and this ref. We can't have a
    //   single state value like `lastReceivedVideoAt` because (1) it won't automatically
    //   trigger a re-render after the video has become stale (2) it would cause a full
    //   re-render of the component for every frame, which is way too often.
    //
    // Alternatively, we could create a timeout that's reset every time we get a video
    //   frame (perhaps using a debounce function), but that becomes harder to clean up
    //   when the component unmounts.
    const lastReceivedVideoAt = useRef(-Infinity);
    const remoteVideoRef = useRef<HTMLCanvasElement | null>(null);
    const canvasContextRef = useRef<CanvasRenderingContext2D | null>(null);
    const imageDataRef = useRef<ImageData | null>(null);

    const [intersectionRef, intersectionObserverEntry] =
      useIntersectionObserver();
    const isVisible = intersectionObserverEntry
      ? intersectionObserverEntry.isIntersecting
      : true;

    useEffect(() => {
      onVisibilityChanged?.(demuxId, isVisible);
    }, [demuxId, isVisible, onVisibilityChanged]);

    const wantsToShowVideo = hasRemoteVideo && !isBlocked && isVisible;
    const hasVideoToShow = wantsToShowVideo && hasReceivedVideoRecently;

    const videoFrameSource = useMemo(
      () => getGroupCallVideoFrameSource(demuxId),
      [getGroupCallVideoFrameSource, demuxId]
    );

    const renderVideoFrame = useCallback(() => {
      const frameAge = Date.now() - lastReceivedVideoAt.current;
      const maxFrameAge = sharingScreen
        ? MAX_TIME_TO_SHOW_STALE_SCREENSHARE_FRAMES
        : MAX_TIME_TO_SHOW_STALE_VIDEO_FRAMES;
      if (frameAge > maxFrameAge) {
        setHasReceivedVideoRecently(false);
      }

      const canvasEl = remoteVideoRef.current;
      if (!canvasEl) {
        return;
      }

      const canvasContext = canvasContextRef.current;
      if (!canvasContext) {
        return;
      }

      // This frame buffer is shared by all participants, so it may contain pixel data
      //   for other participants, or pixel data from a previous frame. That's why we
      //   return early and use the `frameWidth` and `frameHeight`.
      const frameBuffer = getFrameBuffer();
      const frameDimensions = videoFrameSource.receiveVideoFrame(frameBuffer);
      if (!frameDimensions) {
        return;
      }

      const [frameWidth, frameHeight] = frameDimensions;

      if (
        frameWidth < 2 ||
        frameHeight < 2 ||
        frameWidth > MAX_FRAME_WIDTH ||
        frameHeight > MAX_FRAME_HEIGHT
      ) {
        return;
      }

      canvasEl.width = frameWidth;
      canvasEl.height = frameHeight;

      let imageData = imageDataRef.current;
      if (
        imageData?.width !== frameWidth ||
        imageData?.height !== frameHeight
      ) {
        imageData = new ImageData(frameWidth, frameHeight);
        imageDataRef.current = imageData;
      }
      imageData.data.set(frameBuffer.subarray(0, frameWidth * frameHeight * 4));
      canvasContext.putImageData(imageData, 0, 0);

      lastReceivedVideoAt.current = Date.now();

      setHasReceivedVideoRecently(true);
      setIsWide(frameWidth > frameHeight);
    }, [getFrameBuffer, videoFrameSource, sharingScreen]);

    useEffect(() => {
      if (!hasRemoteVideo) {
        setHasReceivedVideoRecently(false);
      }
    }, [hasRemoteVideo]);

    useEffect(() => {
      if (!hasRemoteVideo || !isVisible) {
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
    }, [hasRemoteVideo, isVisible, renderVideoFrame, videoFrameSource]);

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

    if (props.isInPip) {
      containerStyles = canvasStyles;
      avatarSize = AvatarSize.FIFTY_TWO;
    } else {
      const { width, height } = props;
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
        width,
      };

      if ('top' in props) {
        containerStyles.position = 'absolute';
        containerStyles.top = props.top;
        containerStyles.left = props.left;
      }
    }

    return (
      <>
        {showBlockInfo && (
          <ConfirmationDialog
            cancelText={i18n('ok')}
            i18n={i18n}
            onClose={() => {
              setShowBlockInfo(false);
            }}
            title={
              <div className="module-ongoing-call__group-call-remote-participant__blocked--modal-title">
                <Intl
                  i18n={i18n}
                  id="calling__you-have-blocked"
                  components={[<ContactName key="name" title={title} />]}
                />
              </div>
            }
          >
            {i18n('calling__block-info')}
          </ConfirmationDialog>
        )}

        <div
          className="module-ongoing-call__group-call-remote-participant"
          ref={intersectionRef}
          style={containerStyles}
        >
          {!props.isInPip && (
            <div
              className={classNames(
                'module-ongoing-call__group-call-remote-participant__info'
              )}
            >
              <ContactName
                module="module-ongoing-call__group-call-remote-participant__info__contact-name"
                title={title}
              />
              <CallingAudioIndicator
                hasAudio={hasRemoteAudio}
                audioLevel={props.audioLevel}
              />
            </div>
          )}
          {wantsToShowVideo && (
            <canvas
              className="module-ongoing-call__group-call-remote-participant__remote-video"
              style={{
                ...canvasStyles,
                // If we want to show video but don't have any yet, we still render the
                //   canvas invisibly. This lets us render frame data immediately without
                //   having to juggle anything.
                ...(hasVideoToShow ? {} : { display: 'none' }),
              }}
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
          )}
          {!hasVideoToShow && (
            <CallBackgroundBlur avatarPath={avatarPath} color={color}>
              {isBlocked ? (
                <>
                  <i className="module-ongoing-call__group-call-remote-participant__blocked" />
                  <button
                    type="button"
                    className="module-ongoing-call__group-call-remote-participant__blocked--info"
                    onClick={() => {
                      setShowBlockInfo(true);
                    }}
                  >
                    {i18n('moreInfo')}
                  </button>
                </>
              ) : (
                <Avatar
                  acceptedMessageRequest={acceptedMessageRequest}
                  avatarPath={avatarPath}
                  badge={undefined}
                  color={color || AvatarColors[0]}
                  noteToSelf={false}
                  conversationType="direct"
                  i18n={i18n}
                  isMe={isMe}
                  profileName={profileName}
                  title={title}
                  sharedGroupNames={sharedGroupNames}
                  size={avatarSize}
                />
              )}
            </CallBackgroundBlur>
          )}
        </div>
      </>
    );
  }
);
