// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';
import lodash from 'lodash';

import type { VideoFrameSource } from '@signalapp/ringrtc';

import { missingCaseError } from '../util/missingCaseError.std.js';
import { isGroupOrAdhocActiveCall } from '../util/isGroupOrAdhocCall.std.js';
import { useActivateSpeakerViewOnPresenting } from '../hooks/useActivateSpeakerViewOnPresenting.std.js';
import { CallMode } from '../types/CallDisposition.std.js';
import { TooltipPlacement } from './Tooltip.dom.js';
import { CallingButton, CallingButtonType } from './CallingButton.dom.js';
import { CallingPipRemoteVideo } from './CallingPipRemoteVideo.dom.js';
import { CallBackgroundBlur } from './CallBackgroundBlur.dom.js';

import type { LocalizerType } from '../types/Util.std.js';
import type {
  ActiveCallType,
  GroupCallVideoRequest,
} from '../types/Calling.std.js';
import type { SetRendererCanvasType } from '../state/ducks/calling.preload.js';
import type { CallingImageDataCache } from './CallManager.dom.js';
import type { ConversationType } from '../state/ducks/conversations.preload.js';
import { Avatar, AvatarSize } from './Avatar.dom.js';
import { AvatarColors } from '../types/Colors.std.js';

const { minBy, debounce, noop } = lodash;

enum PositionMode {
  BeingDragged,
  SnapToBottom,
  SnapToLeft,
  SnapToRight,
  SnapToTop,
}

type PositionState =
  | {
      mode: PositionMode.BeingDragged;
      mouseX: number;
      mouseY: number;
      dragOffsetX: number;
      dragOffsetY: number;
    }
  | {
      mode: PositionMode.SnapToLeft | PositionMode.SnapToRight;
      offsetY: number;
    }
  | {
      mode: PositionMode.SnapToTop | PositionMode.SnapToBottom;
      offsetX: number;
    };

type SnapCandidate = {
  mode:
    | PositionMode.SnapToBottom
    | PositionMode.SnapToLeft
    | PositionMode.SnapToRight
    | PositionMode.SnapToTop;
  distanceToEdge: number;
};

export type PropsType = {
  activeCall: ActiveCallType;
  getGroupCallVideoFrameSource: (demuxId: number) => VideoFrameSource;
  hangUpActiveCall: (reason: string) => void;
  i18n: LocalizerType;
  imageDataCache: React.RefObject<CallingImageDataCache>;
  me: Readonly<
    Pick<
      ConversationType,
      | 'avatarUrl'
      | 'avatarPlaceholderGradient'
      | 'color'
      | 'type'
      | 'phoneNumber'
      | 'profileName'
      | 'title'
      | 'sharedGroupNames'
    >
  >;
  setGroupCallVideoRequest: (
    _: Array<GroupCallVideoRequest>,
    speakerHeight: number
  ) => void;
  setLocalPreviewContainer: (container: HTMLDivElement | null) => void;
  setRendererCanvas: (_: SetRendererCanvasType) => void;
  switchToPresentationView: () => void;
  switchFromPresentationView: () => void;
  toggleAudio: () => void;
  togglePip: () => void;
  toggleVideo: () => void;
};

const PIP_STARTING_HEIGHT_NORMAL = 286;
const PIP_STARTING_HEIGHT_LARGE = 400;
const LARGE_THRESHOLD = 1200;

export const PIP_WIDTH_NORMAL = 160;
const PIP_WIDTH_LARGE = 224;
const PIP_TOP_MARGIN = 78;
const PIP_PADDING = 8;

// Receiving portrait video will cause the PIP to update to match that video size, but
// we need limits
export const PIP_MINIMUM_HEIGHT_MULTIPLIER = 1.2;
export const PIP_MAXIMUM_HEIGHT_MULTIPLIER = 2;

export function CallingPip({
  activeCall,
  getGroupCallVideoFrameSource,
  hangUpActiveCall,
  imageDataCache,
  i18n,
  me,
  setGroupCallVideoRequest,
  setLocalPreviewContainer,
  setRendererCanvas,
  switchToPresentationView,
  switchFromPresentationView,
  toggleAudio,
  togglePip,
  toggleVideo,
}: PropsType): JSX.Element {
  const isRTL = i18n.getLocaleDirection() === 'rtl';

  const videoContainerRef = React.useRef<null | HTMLDivElement>(null);

  const [windowWidth, setWindowWidth] = React.useState(window.innerWidth);
  const [windowHeight, setWindowHeight] = React.useState(window.innerHeight);
  const [positionState, setPositionState] = React.useState<PositionState>({
    mode: PositionMode.SnapToRight,
    offsetY: PIP_TOP_MARGIN,
  });

  const isWindowLarge = windowWidth >= LARGE_THRESHOLD;
  const [height, setHeight] = React.useState(
    isWindowLarge ? PIP_STARTING_HEIGHT_LARGE : PIP_STARTING_HEIGHT_NORMAL
  );
  const [width, setWidth] = React.useState(
    isWindowLarge ? PIP_WIDTH_LARGE : PIP_WIDTH_NORMAL
  );

  useActivateSpeakerViewOnPresenting({
    remoteParticipants: activeCall.remoteParticipants,
    switchToPresentationView,
    switchFromPresentationView,
  });

  const hangUp = React.useCallback(() => {
    hangUpActiveCall('pip button click');
  }, [hangUpActiveCall]);

  const handleMouseMove = React.useCallback(
    (ev: MouseEvent) => {
      if (positionState.mode === PositionMode.BeingDragged) {
        setPositionState(oldState => ({
          ...oldState,
          mouseX: ev.clientX,
          mouseY: ev.clientY,
        }));
        ev.preventDefault();
        ev.stopPropagation();
      }
    },
    [positionState]
  );

  const handleMouseUp = React.useCallback(() => {
    if (positionState.mode === PositionMode.BeingDragged) {
      const { mouseX, mouseY, dragOffsetX, dragOffsetY } = positionState;
      const { innerHeight, innerWidth } = window;

      const offsetX = mouseX - dragOffsetX;
      const offsetY = mouseY - dragOffsetY;

      let distanceToLeftEdge: number;
      let distanceToRightEdge: number;
      if (isRTL) {
        distanceToLeftEdge = innerWidth - (offsetX + width);
        distanceToRightEdge = offsetX;
      } else {
        distanceToLeftEdge = offsetX;
        distanceToRightEdge = innerWidth - (offsetX + width);
      }

      const snapCandidates: Array<SnapCandidate> = [
        {
          mode: PositionMode.SnapToLeft,
          distanceToEdge: distanceToLeftEdge,
        },
        {
          mode: PositionMode.SnapToRight,
          distanceToEdge: distanceToRightEdge,
        },
        {
          mode: PositionMode.SnapToTop,
          distanceToEdge: offsetY - PIP_TOP_MARGIN,
        },
        {
          mode: PositionMode.SnapToBottom,
          distanceToEdge: innerHeight - (offsetY + height),
        },
      ];

      // This fallback is mostly for TypeScript, because `minBy` says it can return
      //   `undefined`.
      const snapTo =
        minBy(snapCandidates, candidate => candidate.distanceToEdge) ||
        snapCandidates[0];

      switch (snapTo.mode) {
        case PositionMode.SnapToLeft:
        case PositionMode.SnapToRight:
          setPositionState({
            mode: snapTo.mode,
            offsetY,
          });
          break;
        case PositionMode.SnapToTop:
        case PositionMode.SnapToBottom:
          setPositionState({
            mode: snapTo.mode,
            offsetX: isRTL ? innerWidth - (offsetX + width) : offsetX,
          });
          break;
        default:
          throw missingCaseError(snapTo.mode);
      }
    }
  }, [height, isRTL, positionState, setPositionState, width]);

  React.useEffect(() => {
    if (positionState.mode === PositionMode.BeingDragged) {
      document.addEventListener('mousemove', handleMouseMove, false);
      document.addEventListener('mouseup', handleMouseUp, false);

      return () => {
        document.removeEventListener('mouseup', handleMouseUp, false);
        document.removeEventListener('mousemove', handleMouseMove, false);
      };
    }
    return noop;
  }, [positionState.mode, handleMouseMove, handleMouseUp]);

  React.useEffect(() => {
    const handleWindowResize = debounce(
      () => {
        setWindowWidth(window.innerWidth);
        setWindowHeight(window.innerHeight);
      },
      100,
      {
        maxWait: 3000,
      }
    );

    window.addEventListener('resize', handleWindowResize, false);
    return () => {
      window.removeEventListener('resize', handleWindowResize, false);
    };
  }, []);

  // This only runs when isWindowLarge changes, so we aggressively change height + width
  React.useEffect(() => {
    if (isWindowLarge) {
      setHeight(PIP_STARTING_HEIGHT_LARGE);
      setWidth(PIP_WIDTH_LARGE);
    } else {
      setHeight(PIP_STARTING_HEIGHT_NORMAL);
      setWidth(PIP_WIDTH_NORMAL);
    }
  }, [isWindowLarge, setHeight, setWidth]);

  const [translateX, translateY] = React.useMemo<[number, number]>(() => {
    const topMin = PIP_TOP_MARGIN;
    const bottomMax = windowHeight - PIP_PADDING - height;

    const leftScrollPadding = isRTL ? 1 : 0;
    const leftMin = PIP_PADDING + leftScrollPadding;

    const rightScrollPadding = isRTL ? 0 : 1;
    const rightMax = windowWidth - PIP_PADDING - width - rightScrollPadding;

    switch (positionState.mode) {
      case PositionMode.BeingDragged:
        return [
          isRTL
            ? windowWidth -
              positionState.mouseX -
              (width - positionState.dragOffsetX)
            : positionState.mouseX - positionState.dragOffsetX,
          positionState.mouseY - positionState.dragOffsetY,
        ];
      case PositionMode.SnapToLeft:
        return [
          leftMin,
          Math.max(topMin, Math.min(positionState.offsetY, bottomMax)),
        ];
      case PositionMode.SnapToRight:
        return [
          rightMax,
          Math.max(topMin, Math.min(positionState.offsetY, bottomMax)),
        ];
      case PositionMode.SnapToTop:
        return [
          Math.max(leftMin, Math.min(positionState.offsetX, rightMax)),
          topMin,
        ];
      case PositionMode.SnapToBottom:
        return [
          Math.max(leftMin, Math.min(positionState.offsetX, rightMax)),
          bottomMax,
        ];
      default:
        throw missingCaseError(positionState);
    }
  }, [height, isRTL, width, windowWidth, windowHeight, positionState]);
  const localizedTranslateX = isRTL ? -translateX : translateX;

  const [showControls, setShowControls] = React.useState(false);
  const onMouseEnter = React.useCallback(() => {
    setShowControls(true);
  }, [setShowControls]);
  const onMouseMove = React.useCallback(() => {
    setShowControls(true);
  }, [setShowControls]);

  const [controlsHover, setControlsHover] = React.useState(false);
  const onControlsMouseEnter = React.useCallback(() => {
    setControlsHover(true);
  }, [setControlsHover]);

  const onControlsMouseLeave = React.useCallback(() => {
    setControlsHover(false);
  }, [setControlsHover]);

  React.useEffect(() => {
    if (!showControls) {
      return;
    }
    if (controlsHover) {
      return;
    }

    const timer = setTimeout(() => {
      setShowControls(false);
    }, 2000);
    return clearTimeout.bind(null, timer);
  }, [showControls, controlsHover, setShowControls]);

  const localVideoClassName = activeCall.presentingSource
    ? 'module-calling-pip__video--local-presenting'
    : 'module-calling-pip__video--local';

  let raisedHandsCount = 0;
  let callJoinRequests = 0;
  if (isGroupOrAdhocActiveCall(activeCall)) {
    raisedHandsCount = activeCall.raisedHands.size;
    callJoinRequests = activeCall.pendingParticipants.length;
  }

  let videoButtonType: CallingButtonType;
  if (activeCall.presentingSource) {
    videoButtonType = CallingButtonType.VIDEO_DISABLED;
  } else if (activeCall.hasLocalVideo) {
    videoButtonType = CallingButtonType.VIDEO_ON;
  } else {
    videoButtonType = CallingButtonType.VIDEO_OFF;
  }
  const audioButtonType = activeCall.hasLocalAudio
    ? CallingButtonType.AUDIO_ON
    : CallingButtonType.AUDIO_OFF;
  const hangupButtonType =
    activeCall.callMode === CallMode.Direct
      ? CallingButtonType.HANGUP_DIRECT
      : CallingButtonType.HANGUP_GROUP;

  let remoteVideoNode: JSX.Element;
  const isLonelyInCall = !activeCall.remoteParticipants.length;
  const isSendingVideo =
    activeCall.hasLocalVideo || activeCall.presentingSource;
  const avatarSize = isWindowLarge
    ? AvatarSize.NINETY_SIX
    : AvatarSize.SIXTY_FOUR;

  if (isLonelyInCall) {
    remoteVideoNode = (
      <div className="module-calling-pip__video--remote">
        {isSendingVideo ? (
          // TODO: DESKTOP-8537 - when black bars go away, need to make some CSS changes
          <>
            <CallBackgroundBlur avatarUrl={me.avatarUrl} darken />
            <div
              className={classNames(
                'module-calling-pip__full-size-local-preview',
                activeCall.presentingSource
                  ? 'module-calling-pip__full-size-local-preview--presenting'
                  : undefined
              )}
              ref={setLocalPreviewContainer}
            />
          </>
        ) : (
          <CallBackgroundBlur avatarUrl={me.avatarUrl}>
            <div className="module-calling-pip__video--avatar">
              <Avatar
                avatarPlaceholderGradient={me.avatarPlaceholderGradient}
                avatarUrl={me.avatarUrl}
                badge={undefined}
                color={me.color || AvatarColors[0]}
                noteToSelf={false}
                conversationType={me.type}
                i18n={i18n}
                phoneNumber={me.phoneNumber}
                profileName={me.profileName}
                title={me.title}
                size={avatarSize}
                sharedGroupNames={[]}
              />
            </div>
          </CallBackgroundBlur>
        )}
      </div>
    );
  } else {
    remoteVideoNode = (
      <CallingPipRemoteVideo
        activeCall={activeCall}
        getGroupCallVideoFrameSource={getGroupCallVideoFrameSource}
        imageDataCache={imageDataCache}
        i18n={i18n}
        setRendererCanvas={setRendererCanvas}
        setGroupCallVideoRequest={setGroupCallVideoRequest}
        height={height}
        width={width}
        updateHeight={(newHeight: number) => {
          setHeight(newHeight);
        }}
      />
    );
  }
  const localVideoWidth = isWindowLarge ? 120 : 80;
  const localVideoHeight = isWindowLarge ? 80 : 54;

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="module-calling-pip"
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseMove}
      onMouseDown={ev => {
        const node = videoContainerRef.current;
        if (!node) {
          return;
        }

        const targetNode = ev.target as Element;
        if (targetNode?.tagName === 'BUTTON') {
          return;
        }
        const parentNode = targetNode.parentNode as Element;
        if (parentNode?.tagName === 'BUTTON') {
          return;
        }

        const rect = node.getBoundingClientRect();
        const dragOffsetX = ev.clientX - rect.left;
        const dragOffsetY = ev.clientY - rect.top;

        setPositionState({
          mode: PositionMode.BeingDragged,
          mouseX: ev.clientX,
          mouseY: ev.clientY,
          dragOffsetX,
          dragOffsetY,
        });
      }}
      ref={videoContainerRef}
      style={{
        height: `${height}px`,
        width: `${width}px`,
        cursor:
          positionState.mode === PositionMode.BeingDragged
            ? '-webkit-grabbing'
            : '-webkit-grab',
        transform: `translate3d(${localizedTranslateX}px,calc(${translateY}px), 0)`,
        transition:
          positionState.mode === PositionMode.BeingDragged
            ? 'none'
            : 'transform ease-out 300ms',
      }}
    >
      {remoteVideoNode}

      {!isLonelyInCall && activeCall.hasLocalVideo ? (
        <div
          style={{
            height: `${localVideoHeight}px`,
            width: `${localVideoWidth}px`,
          }}
          className={localVideoClassName}
          ref={setLocalPreviewContainer}
        />
      ) : null}

      <div
        className={classNames(
          'module-calling-pip__un-pip-container',
          showControls
            ? 'module-calling-pip__un-pip-container--visible'
            : undefined
        )}
      >
        <CallingButton
          buttonType={CallingButtonType.FULL_SCREEN_CALL}
          i18n={i18n}
          onMouseEnter={onControlsMouseEnter}
          onMouseLeave={onControlsMouseLeave}
          onClick={togglePip}
          tooltipDirection={TooltipPlacement.Top}
        />
      </div>
      {raisedHandsCount || callJoinRequests ? (
        <div
          className={classNames(
            'module-calling-pip__pills',
            !showControls ? 'module-calling-pip__pills--no-controls' : undefined
          )}
        >
          {raisedHandsCount ? (
            <div className="module-calling-pip__pill">
              <div
                className={classNames(
                  'module-calling-pip__pill-icon',
                  'module-calling-pip__pill-icon__raised-hands'
                )}
              />
              {raisedHandsCount}
            </div>
          ) : undefined}
          {callJoinRequests ? (
            <div className="module-calling-pip__pill">
              <div
                className={classNames(
                  'module-calling-pip__pill-icon',
                  'module-calling-pip__pill-icon__group-join'
                )}
              />
              {callJoinRequests}
            </div>
          ) : undefined}
        </div>
      ) : undefined}
      <div
        className={classNames(
          'module-calling-pip__actions',
          showControls ? 'module-calling-pip__actions--visible' : undefined
        )}
      >
        <div className="module-calling-pip__actions__spacer" />
        <div className="module-calling-pip__actions__button">
          <CallingButton
            buttonType={videoButtonType}
            i18n={i18n}
            onMouseEnter={onControlsMouseEnter}
            onMouseLeave={onControlsMouseLeave}
            onClick={toggleVideo}
            tooltipDirection={TooltipPlacement.Top}
          />
        </div>
        <div className="module-calling-pip__actions__button module-calling-pip__actions__middle-button">
          <CallingButton
            buttonType={audioButtonType}
            i18n={i18n}
            onMouseEnter={onControlsMouseEnter}
            onMouseLeave={onControlsMouseLeave}
            onClick={toggleAudio}
            tooltipDirection={TooltipPlacement.Top}
          />
        </div>
        <div className="module-calling-pip__actions__button">
          <CallingButton
            buttonType={hangupButtonType}
            i18n={i18n}
            onMouseEnter={onControlsMouseEnter}
            onMouseLeave={onControlsMouseLeave}
            onClick={hangUp}
            tooltipDirection={TooltipPlacement.Top}
          />
        </div>
        <div className="module-calling-pip__actions__spacer" />
      </div>
    </div>
  );
}
