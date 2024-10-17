// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { minBy, debounce, noop } from 'lodash';
import type { VideoFrameSource } from '@signalapp/ringrtc';
import { CallingPipRemoteVideo } from './CallingPipRemoteVideo';
import type { LocalizerType } from '../types/Util';
import type { ActiveCallType, GroupCallVideoRequest } from '../types/Calling';
import type { SetRendererCanvasType } from '../state/ducks/calling';
import { missingCaseError } from '../util/missingCaseError';
import { useActivateSpeakerViewOnPresenting } from '../hooks/useActivateSpeakerViewOnPresenting';
import type { CallingImageDataCache } from './CallManager';

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
  hasLocalVideo: boolean;
  i18n: LocalizerType;
  imageDataCache: React.RefObject<CallingImageDataCache>;
  setGroupCallVideoRequest: (
    _: Array<GroupCallVideoRequest>,
    speakerHeight: number
  ) => void;
  setLocalPreviewContainer: (container: HTMLDivElement | null) => void;
  setRendererCanvas: (_: SetRendererCanvasType) => void;
  switchToPresentationView: () => void;
  switchFromPresentationView: () => void;
  togglePip: () => void;
};

const PIP_HEIGHT = 156;
const PIP_WIDTH = 120;
const PIP_TOP_MARGIN = 56;
const PIP_PADDING = 8;

export function CallingPip({
  activeCall,
  getGroupCallVideoFrameSource,
  hangUpActiveCall,
  hasLocalVideo,
  imageDataCache,
  i18n,
  setGroupCallVideoRequest,
  setLocalPreviewContainer,
  setRendererCanvas,
  switchToPresentationView,
  switchFromPresentationView,
  togglePip,
}: PropsType): JSX.Element {
  const isRTL = i18n.getLocaleDirection() === 'rtl';

  const videoContainerRef = React.useRef<null | HTMLDivElement>(null);

  const [windowWidth, setWindowWidth] = React.useState(window.innerWidth);
  const [windowHeight, setWindowHeight] = React.useState(window.innerHeight);
  const [positionState, setPositionState] = React.useState<PositionState>({
    mode: PositionMode.SnapToRight,
    offsetY: PIP_TOP_MARGIN,
  });

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
        distanceToLeftEdge = innerWidth - (offsetX + PIP_WIDTH);
        distanceToRightEdge = offsetX;
      } else {
        distanceToLeftEdge = offsetX;
        distanceToRightEdge = innerWidth - (offsetX + PIP_WIDTH);
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
          distanceToEdge: innerHeight - (offsetY + PIP_HEIGHT),
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
            offsetX: isRTL ? innerWidth - (offsetX + PIP_WIDTH) : offsetX,
          });
          break;
        default:
          throw missingCaseError(snapTo.mode);
      }
    }
  }, [isRTL, positionState, setPositionState]);

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

  const [translateX, translateY] = React.useMemo<[number, number]>(() => {
    switch (positionState.mode) {
      case PositionMode.BeingDragged:
        return [
          isRTL
            ? windowWidth -
              positionState.mouseX -
              (PIP_WIDTH - positionState.dragOffsetX)
            : positionState.mouseX - positionState.dragOffsetX,
          positionState.mouseY - positionState.dragOffsetY,
        ];
      case PositionMode.SnapToLeft:
        return [
          PIP_PADDING,
          Math.min(
            positionState.offsetY,
            windowHeight - PIP_PADDING - PIP_HEIGHT
          ),
        ];
      case PositionMode.SnapToRight:
        return [
          windowWidth - PIP_PADDING - PIP_WIDTH,
          Math.min(
            positionState.offsetY,
            windowHeight - PIP_PADDING - PIP_HEIGHT
          ),
        ];
      case PositionMode.SnapToTop:
        return [
          Math.min(
            positionState.offsetX,
            windowWidth - PIP_PADDING - PIP_WIDTH
          ),
          PIP_TOP_MARGIN + PIP_PADDING,
        ];
      case PositionMode.SnapToBottom:
        return [
          Math.min(
            positionState.offsetX,
            windowWidth - PIP_PADDING - PIP_WIDTH
          ),
          windowHeight - PIP_PADDING - PIP_HEIGHT,
        ];
      default:
        throw missingCaseError(positionState);
    }
  }, [isRTL, windowWidth, windowHeight, positionState]);
  const localizedTranslateX = isRTL ? -translateX : translateX;

  const localVideoClassName = activeCall.presentingSource
    ? 'module-calling-pip__video--local-presenting'
    : 'module-calling-pip__video--local';

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="module-calling-pip"
      onMouseDown={ev => {
        const node = videoContainerRef.current;
        if (!node) {
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
      <CallingPipRemoteVideo
        activeCall={activeCall}
        getGroupCallVideoFrameSource={getGroupCallVideoFrameSource}
        imageDataCache={imageDataCache}
        i18n={i18n}
        setRendererCanvas={setRendererCanvas}
        setGroupCallVideoRequest={setGroupCallVideoRequest}
      />
      {hasLocalVideo ? (
        <div className={localVideoClassName} ref={setLocalPreviewContainer} />
      ) : null}
      <div className="module-calling-pip__actions">
        <button
          aria-label={i18n('icu:calling__hangup')}
          className="module-calling-pip__button--hangup"
          onClick={hangUp}
          type="button"
        />
        <button
          aria-label={i18n('icu:calling__pip--off')}
          className="module-calling-pip__button--pip"
          onClick={togglePip}
          type="button"
        >
          <div />
        </button>
      </div>
    </div>
  );
}
