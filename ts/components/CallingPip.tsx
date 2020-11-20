// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { CallingPipRemoteVideo } from './CallingPipRemoteVideo';
import { LocalizerType } from '../types/Util';
import { VideoFrameSource } from '../types/Calling';
import {
  ActiveCallType,
  HangUpType,
  SetLocalPreviewType,
  SetRendererCanvasType,
} from '../state/ducks/calling';

export type PropsType = {
  activeCall: ActiveCallType;
  getGroupCallVideoFrameSource: (demuxId: number) => VideoFrameSource;
  hangUp: (_: HangUpType) => void;
  hasLocalVideo: boolean;
  i18n: LocalizerType;
  setLocalPreview: (_: SetLocalPreviewType) => void;
  setRendererCanvas: (_: SetRendererCanvasType) => void;
  togglePip: () => void;
};

const PIP_HEIGHT = 156;
const PIP_WIDTH = 120;
const PIP_DEFAULT_Y = 56;
const PIP_PADDING = 8;

export const CallingPip = ({
  activeCall,
  getGroupCallVideoFrameSource,
  hangUp,
  hasLocalVideo,
  i18n,
  setLocalPreview,
  setRendererCanvas,
  togglePip,
}: PropsType): JSX.Element | null => {
  const videoContainerRef = React.useRef(null);
  const localVideoRef = React.useRef(null);

  const [dragState, setDragState] = React.useState({
    offsetX: 0,
    offsetY: 0,
    isDragging: false,
  });

  const [dragContainerStyle, setDragContainerStyle] = React.useState({
    translateX: window.innerWidth - PIP_WIDTH - PIP_PADDING,
    translateY: PIP_DEFAULT_Y,
  });

  React.useEffect(() => {
    setLocalPreview({ element: localVideoRef });
  }, [setLocalPreview]);

  const handleMouseMove = React.useCallback(
    (ev: MouseEvent) => {
      if (dragState.isDragging) {
        setDragContainerStyle({
          translateX: ev.clientX - dragState.offsetX,
          translateY: ev.clientY - dragState.offsetY,
        });
      }
    },
    [dragState]
  );

  const handleMouseUp = React.useCallback(() => {
    if (dragState.isDragging) {
      const { translateX, translateY } = dragContainerStyle;
      const { innerHeight, innerWidth } = window;

      const proximityRatio: Record<string, number> = {
        top: translateY / innerHeight,
        right: (innerWidth - translateX) / innerWidth,
        bottom: (innerHeight - translateY) / innerHeight,
        left: translateX / innerWidth,
      };

      const snapTo = Object.keys(proximityRatio).reduce(
        (minKey: string, key: string): string => {
          return proximityRatio[key] < proximityRatio[minKey] ? key : minKey;
        }
      );

      setDragState({
        ...dragState,
        isDragging: false,
      });

      let nextX = Math.max(
        PIP_PADDING,
        Math.min(translateX, innerWidth - PIP_WIDTH - PIP_PADDING)
      );
      let nextY = Math.max(
        PIP_DEFAULT_Y,
        Math.min(translateY, innerHeight - PIP_HEIGHT - PIP_PADDING)
      );

      if (snapTo === 'top') {
        nextY = PIP_DEFAULT_Y;
      }
      if (snapTo === 'right') {
        nextX = innerWidth - PIP_WIDTH - PIP_PADDING;
      }
      if (snapTo === 'bottom') {
        nextY = innerHeight - PIP_HEIGHT - PIP_PADDING;
      }
      if (snapTo === 'left') {
        nextX = PIP_PADDING;
      }

      setDragContainerStyle({
        translateX: nextX,
        translateY: nextY,
      });
    }
  }, [dragState, dragContainerStyle]);

  React.useEffect(() => {
    if (dragState.isDragging) {
      document.addEventListener('mousemove', handleMouseMove, false);
      document.addEventListener('mouseup', handleMouseUp, false);
    } else {
      document.removeEventListener('mouseup', handleMouseUp, false);
      document.removeEventListener('mousemove', handleMouseMove, false);
    }

    return () => {
      document.removeEventListener('mouseup', handleMouseUp, false);
      document.removeEventListener('mousemove', handleMouseMove, false);
    };
  }, [dragState, handleMouseMove, handleMouseUp]);

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="module-calling-pip"
      onMouseDown={ev => {
        const node = videoContainerRef.current;
        if (!node) {
          return;
        }
        const rect = (node as HTMLElement).getBoundingClientRect();
        const offsetX = ev.clientX - rect.left;
        const offsetY = ev.clientY - rect.top;

        setDragState({
          isDragging: true,
          offsetX,
          offsetY,
        });
      }}
      ref={videoContainerRef}
      style={{
        cursor: dragState.isDragging ? '-webkit-grabbing' : '-webkit-grab',
        transform: `translate3d(${dragContainerStyle.translateX}px,${dragContainerStyle.translateY}px, 0)`,
        transition: dragState.isDragging ? 'none' : 'transform ease-out 300ms',
      }}
    >
      <CallingPipRemoteVideo
        activeCall={activeCall}
        getGroupCallVideoFrameSource={getGroupCallVideoFrameSource}
        i18n={i18n}
        setRendererCanvas={setRendererCanvas}
      />
      {hasLocalVideo ? (
        <video
          className="module-calling-pip__video--local"
          ref={localVideoRef}
          autoPlay
        />
      ) : null}
      <div className="module-calling-pip__actions">
        <button
          aria-label={i18n('calling__hangup')}
          className="module-calling-pip__button--hangup"
          onClick={() => {
            hangUp({ conversationId: activeCall.conversation.id });
          }}
          type="button"
        />
        <button
          aria-label={i18n('calling__pip--off')}
          className="module-calling-pip__button--pip"
          onClick={togglePip}
          type="button"
        >
          <div />
        </button>
      </div>
    </div>
  );
};
