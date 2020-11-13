// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useRef, useEffect, CSSProperties } from 'react';
import { noop } from 'lodash';
import { CanvasVideoRenderer, VideoFrameSource } from '../types/Calling';
import { CallBackgroundBlur } from './CallBackgroundBlur';

interface PropsType {
  createCanvasVideoRenderer: () => CanvasVideoRenderer;
  demuxId: number;
  getGroupCallVideoFrameSource: (demuxId: number) => VideoFrameSource;
  hasRemoteVideo: boolean;
  height: number;
  left: number;
  top: number;
  width: number;
}

export const GroupCallRemoteParticipant: React.FC<PropsType> = ({
  createCanvasVideoRenderer,
  demuxId,
  getGroupCallVideoFrameSource,
  hasRemoteVideo,
  height,
  left,
  top,
  width,
}) => {
  const remoteVideoRef = useRef<HTMLCanvasElement | null>(null);
  const canvasVideoRendererRef = useRef(createCanvasVideoRenderer());

  useEffect(() => {
    const canvasVideoRenderer = canvasVideoRendererRef.current;

    if (hasRemoteVideo) {
      canvasVideoRenderer.setCanvas(remoteVideoRef);
      canvasVideoRenderer.enable(getGroupCallVideoFrameSource(demuxId));
      return () => {
        canvasVideoRenderer.disable();
      };
    }

    canvasVideoRenderer.disable();
    return noop;
  }, [hasRemoteVideo, getGroupCallVideoFrameSource, demuxId]);

  // If our `width` and `height` props don't match the canvas's aspect ratio, we want to
  //   fill the container. This can happen when RingRTC gives us an inaccurate
  //   `videoAspectRatio`.
  const canvasStyles: CSSProperties = {};
  const canvasEl = remoteVideoRef.current;
  if (hasRemoteVideo && canvasEl) {
    if (canvasEl.width > canvasEl.height) {
      canvasStyles.width = '100%';
    } else {
      canvasStyles.height = '100%';
    }
  }

  return (
    <div
      className="module-ongoing-call__group-call-remote-participant"
      style={{
        position: 'absolute',
        width,
        height,
        top,
        left,
      }}
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
