// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { VideoFrameSource } from '@signalapp/ringrtc';
import { createLogger } from '../logging/log.std.ts';
import * as Errors from '../types/errors.std.ts';
import {
  FRAME_BUFFER_SIZE,
  MAX_FRAME_HEIGHT,
  MAX_FRAME_WIDTH,
} from '../calling/constants.std.ts';
import { usePageVisibility } from './usePageVisibility.dom.ts';

const log = createLogger('useNativeCallPictureInPicture');

// Remote participant canvases rendered by DirectCallRemoteParticipant and
// GroupCallRemoteParticipant, in both the call screen and the in-app pip.
const REMOTE_VIDEO_CANVAS_SELECTOR = [
  'canvas.module-ongoing-call__remote-video-enabled',
  'canvas.module-ongoing-call__group-call-remote-participant__remote-video',
].join(',');

const FRAME_INTERVAL_MS = 1000 / 30;
// If the main window hasn't painted for this long (minimized, on another
// workspace), its canvases are stale and we pull frames from RingRTC directly.
const MAIN_WINDOW_STALLED_MS = 250;
const FALLBACK_WIDTH = 640;
const FALLBACK_HEIGHT = 360;

// Not yet part of TypeScript's DOM lib
type MediaSessionWithCallControls = MediaSession & {
  setMicrophoneActive?: (active: boolean) => Promise<void>;
  setCameraActive?: (active: boolean) => Promise<void>;
};

// Chromium-only (Insertable Streams), not in TypeScript's DOM lib
type MediaStreamTrackGeneratorType = MediaStreamTrack & {
  writable: WritableStream<VideoFrame>;
};
type MediaStreamTrackGeneratorConstructor = new (init: {
  kind: 'video';
}) => MediaStreamTrackGeneratorType;

type CallMediaSessionAction = 'hangup' | 'togglemicrophone' | 'togglecamera';

type NativeCallPictureInPictureOptions = Readonly<{
  title: string;
  hasLocalAudio: boolean;
  hasLocalVideo: boolean;
  getVideoFrameSource: () => VideoFrameSource | undefined;
  hangUp: () => void;
  toggleAudio: () => void;
  toggleVideo: () => void;
}>;

type NativeCallPictureInPictureResult = Readonly<{
  isSupported: boolean;
  isActive: boolean;
  toggle: () => void;
}>;

// Shared so call components keep requesting remote video while the main
// window is hidden but the pip window is still showing it.
let isNativePipActive = false;
const nativePipListeners = new Set<() => void>();

function setNativePipActive(value: boolean): void {
  if (isNativePipActive === value) {
    return;
  }
  isNativePipActive = value;
  nativePipListeners.forEach(listener => listener());
}

function subscribeToNativePip(listener: () => void): () => void {
  nativePipListeners.add(listener);
  return () => {
    nativePipListeners.delete(listener);
  };
}

function getIsNativePipActive(): boolean {
  return isNativePipActive;
}

/**
 * Like `usePageVisibility`, but also true while call video is shown in the
 * OS-level picture-in-picture window.
 */
export function useIsCallVideoVisible(): boolean {
  const isPageVisible = usePageVisibility();
  const isPipActive = useSyncExternalStore(
    subscribeToNativePip,
    getIsNativePipActive
  );
  return isPageVisible || isPipActive;
}

function findLargestRemoteVideoCanvas(): HTMLCanvasElement | undefined {
  let best: HTMLCanvasElement | undefined;
  let bestArea = 0;
  for (const canvas of document.querySelectorAll<HTMLCanvasElement>(
    REMOTE_VIDEO_CANVAS_SELECTOR
  )) {
    // Hidden canvases (e.g. offscreen participants) have no layout box
    const area = canvas.clientWidth * canvas.clientHeight;
    if (canvas.width <= 2 || canvas.height <= 2 || area <= bestArea) {
      continue;
    }
    best = canvas;
    bestArea = area;
  }
  return best;
}

/**
 * Pops the remote call video out into an OS-level picture-in-picture window,
 * which can be moved independently of the main window (other monitors or
 * workspaces) and stays on top of other applications.
 *
 * While the main window is painting, frames are copied from its largest
 * remote video canvas. Once it stops painting (minimized, other workspace),
 * frames are pulled from RingRTC directly. Frames are fed to a hidden
 * <video> through a MediaStreamTrackGenerator, which, unlike
 * `canvas.captureStream()`, keeps producing frames for a hidden page.
 */
export function useNativeCallPictureInPicture(
  options: NativeCallPictureInPictureOptions
): NativeCallPictureInPictureResult {
  const isSupported =
    typeof document !== 'undefined' && document.pictureInPictureEnabled;

  const [isActive, setIsActive] = useState(false);

  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cleanupRef = useRef<(() => void) | undefined>(undefined);
  const isEnteringRef = useRef(false);

  const stopRendering = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = undefined;
    const video = videoRef.current;
    if (video) {
      const stream = video.srcObject;
      if (stream instanceof MediaStream) {
        stream.getTracks().forEach(track => track.stop());
      }
      video.srcObject = null;
      video.remove();
      videoRef.current = null;
    }
  }, []);

  const exit = useCallback(async () => {
    if (document.pictureInPictureElement) {
      try {
        await document.exitPictureInPicture();
      } catch (error) {
        log.warn('Failed to exit', Errors.toLogFormat(error));
      }
    }
    stopRendering();
  }, [stopRendering]);

  const enter = useCallback(async () => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      log.error('Unable to get 2d context');
      return;
    }

    // Set once this session is torn down, so late failures don't affect a
    // newer session
    let isStopped = false;

    // Only allocated once the main window stalls
    let frameBuffer: Uint8Array<ArrayBuffer> | undefined;

    const drawFallback = (): void => {
      if (
        canvas.width !== FALLBACK_WIDTH ||
        canvas.height !== FALLBACK_HEIGHT
      ) {
        canvas.width = FALLBACK_WIDTH;
        canvas.height = FALLBACK_HEIGHT;
      }
      context.fillStyle = '#121212';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#ffffff';
      context.font = '600 28px Inter, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(
        optionsRef.current.title,
        canvas.width / 2,
        canvas.height / 2,
        canvas.width
      );
    };

    let lastPaintAt = performance.now();
    let rafId = requestAnimationFrame(function onPaint() {
      lastPaintAt = performance.now();
      rafId = requestAnimationFrame(onPaint);
    });

    // Returns false if there's no new frame
    const renderFrame = (): boolean => {
      const isMainWindowPainting =
        performance.now() - lastPaintAt < MAIN_WINDOW_STALLED_MS;

      if (isMainWindowPainting) {
        const source = findLargestRemoteVideoCanvas();
        if (!source) {
          drawFallback();
          return true;
        }
        if (canvas.width !== source.width) {
          canvas.width = source.width;
        }
        if (canvas.height !== source.height) {
          canvas.height = source.height;
        }
        context.drawImage(source, 0, 0);
        return true;
      }

      const frameSource = optionsRef.current.getVideoFrameSource();
      if (!frameSource) {
        drawFallback();
        return true;
      }
      if (!frameBuffer) {
        frameBuffer = new Uint8Array(FRAME_BUFFER_SIZE);
      }
      const dimensions = frameSource.receiveVideoFrame(
        frameBuffer,
        MAX_FRAME_WIDTH,
        MAX_FRAME_HEIGHT
      );
      if (!dimensions) {
        return false;
      }
      const [width, height] = dimensions;
      if (
        width <= 2 ||
        height <= 2 ||
        width > MAX_FRAME_WIDTH ||
        height > MAX_FRAME_HEIGHT
      ) {
        return false;
      }
      if (canvas.width !== width) {
        canvas.width = width;
      }
      if (canvas.height !== height) {
        canvas.height = height;
      }
      context.putImageData(
        new ImageData(
          new Uint8ClampedArray(
            frameBuffer.buffer,
            frameBuffer.byteOffset,
            width * height * 4
          ),
          width,
          height
        ),
        0,
        0
      );
      return true;
    };
    renderFrame();

    let stream: MediaStream;
    let pushFrame: () => void;
    const Generator = (
      window as unknown as {
        MediaStreamTrackGenerator?: MediaStreamTrackGeneratorConstructor;
      }
    ).MediaStreamTrackGenerator;
    if (Generator) {
      const track = new Generator({ kind: 'video' });
      const writer = track.writable.getWriter();
      stream = new MediaStream([track]);
      // Skip ticks while the previous frame is still being consumed, rather
      // than queueing frames up.
      let isWriting = false;
      const writeFrame = async (frame: VideoFrame): Promise<void> => {
        try {
          await writer.write(frame);
          isWriting = false;
        } catch (error) {
          frame.close();
          if (isStopped) {
            return;
          }
          // A failed writer stays errored, so no further frames can be shown
          log.error('Failed to write frame', Errors.toLogFormat(error));
          void exit();
        }
      };
      pushFrame = () => {
        if (isWriting || !renderFrame()) {
          return;
        }
        isWriting = true;
        // The track takes ownership of the frame and closes it once consumed
        const frame = new VideoFrame(canvas, {
          timestamp: Math.round(performance.now() * 1000),
        });
        void writeFrame(frame);
      };
    } else {
      log.warn(
        'MediaStreamTrackGenerator missing, pip may freeze in background'
      );
      stream = canvas.captureStream(30);
      pushFrame = () => {
        renderFrame();
      };
    }

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    // Kept rendered (but invisible) so Chromium will decode frames for it
    Object.assign(video.style, {
      position: 'fixed',
      width: '1px',
      height: '1px',
      opacity: '0',
      pointerEvents: 'none',
    });
    video.srcObject = stream;
    // The pip window shows play/pause controls; a paused call makes no sense
    video.addEventListener('pause', () => {
      if (videoRef.current === video) {
        void video.play();
      }
    });
    video.addEventListener('enterpictureinpicture', () => {
      setIsActive(true);
      setNativePipActive(true);
      window.IPC.setBackgroundThrottling(false);
    });
    video.addEventListener('leavepictureinpicture', () => {
      setIsActive(false);
      setNativePipActive(false);
      window.IPC.setBackgroundThrottling(true);
      if (videoRef.current === video) {
        stopRendering();
      }
    });
    document.body.appendChild(video);

    stopRendering();
    videoRef.current = video;
    // Timers keep running while the main window is in the background, unlike
    // requestAnimationFrame.
    pushFrame();
    const intervalId = setInterval(pushFrame, FRAME_INTERVAL_MS);
    cleanupRef.current = () => {
      isStopped = true;
      clearInterval(intervalId);
      cancelAnimationFrame(rafId);
      frameBuffer = undefined;
    };

    try {
      await video.play();
      await video.requestPictureInPicture();
    } catch (error) {
      log.error('Failed to enter', Errors.toLogFormat(error));
      stopRendering();
    }
  }, [exit, stopRendering]);

  const toggle = useCallback(() => {
    if (!isSupported) {
      return;
    }
    if (isEnteringRef.current) {
      return;
    }
    if (document.pictureInPictureElement) {
      void exit();
      return;
    }
    const enterOnce = async () => {
      isEnteringRef.current = true;
      try {
        await enter();
      } catch (error) {
        log.error('Failed to enter', Errors.toLogFormat(error));
      }
      isEnteringRef.current = false;
    };
    void enterOnce();
  }, [enter, exit, isSupported]);

  // Call controls inside the pip window
  useEffect(() => {
    if (!isActive || !('mediaSession' in navigator)) {
      return;
    }
    const mediaSession = navigator.mediaSession as MediaSessionWithCallControls;
    const handlers: Record<CallMediaSessionAction, () => void> = {
      hangup: () => optionsRef.current.hangUp(),
      togglemicrophone: () => optionsRef.current.toggleAudio(),
      togglecamera: () => optionsRef.current.toggleVideo(),
    };
    for (const [action, handler] of Object.entries(handlers)) {
      try {
        mediaSession.setActionHandler(action as MediaSessionAction, handler);
      } catch {
        // Unsupported action in this Chromium version
      }
    }

    return () => {
      for (const action of Object.keys(handlers)) {
        try {
          mediaSession.setActionHandler(action as MediaSessionAction, null);
        } catch {
          // Unsupported action in this Chromium version
        }
      }
    };
  }, [isActive]);

  useEffect(() => {
    if (!isActive || !('mediaSession' in navigator)) {
      return;
    }
    const mediaSession = navigator.mediaSession as MediaSessionWithCallControls;
    void mediaSession.setMicrophoneActive?.(options.hasLocalAudio);
    void mediaSession.setCameraActive?.(options.hasLocalVideo);
  }, [isActive, options.hasLocalAudio, options.hasLocalVideo]);

  // Close the pip window when the call goes away
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        setNativePipActive(false);
        window.IPC.setBackgroundThrottling(true);
      }
      void exit();
    };
  }, [exit]);

  return { isSupported, isActive, toggle };
}
