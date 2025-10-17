// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable max-classes-per-file */
/* eslint-disable no-restricted-syntax */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-await-in-loop */

import { videoPixelFormatToEnum } from '@signalapp/ringrtc';
import type { VideoFrameSender, VideoFrameSource } from '@signalapp/ringrtc';
import type { RefObject } from 'react';
import { createLogger } from '../logging/log.std.js';

const log = createLogger('VideoSupport');

export class GumVideoCaptureOptions {
  maxWidth = 640;
  maxHeight = 480;
  maxFramerate = 30;
  preferredDeviceId?: string;
  screenShareSourceId?: string;
  mediaStream?: MediaStream;
  onEnded?: () => void;
}

interface GumTrackConstraints extends MediaTrackConstraints {
  mandatory?: GumTrackConstraintSet;
}

type GumTrackConstraintSet = {
  chromeMediaSource: string;
  chromeMediaSourceId?: string;
  maxWidth: number;
  maxHeight: number;
  minFrameRate: number;
  maxFrameRate: number;
};

export class GumVideoCapturer {
  private defaultCaptureOptions: GumVideoCaptureOptions;
  private localPreview?: RefObject<HTMLVideoElement>;
  private captureOptions?: GumVideoCaptureOptions;
  private sender?: VideoFrameSender;
  private mediaStream?: MediaStream;
  private spawnedSenderRunning = false;
  private preferredDeviceId?: string;
  private updateLocalPreviewIntervalId?: any;

  constructor(defaultCaptureOptions: GumVideoCaptureOptions) {
    this.defaultCaptureOptions = defaultCaptureOptions;
  }

  capturing(): boolean {
    return this.captureOptions !== undefined;
  }

  setLocalPreview(localPreview: RefObject<HTMLVideoElement> | undefined): void {
    const oldLocalPreview = this.localPreview?.current;
    if (oldLocalPreview) {
      oldLocalPreview.srcObject = null;
    }

    this.localPreview = localPreview;

    this.updateLocalPreviewSourceObject();

    // This is a dumb hack around the fact that sometimes the
    // this.localPreview.current is updated without a call
    // to setLocalPreview, in which case the local preview
    // won't be rendered.
    if (this.updateLocalPreviewIntervalId !== undefined) {
      clearInterval(this.updateLocalPreviewIntervalId);
    }
    this.updateLocalPreviewIntervalId = setInterval(
      this.updateLocalPreviewSourceObject.bind(this),
      1000
    );
  }

  async enableCapture(options?: GumVideoCaptureOptions): Promise<void> {
    return this.startCapturing(options ?? this.defaultCaptureOptions);
  }

  async enableCaptureAndSend(
    sender?: VideoFrameSender,
    options?: GumVideoCaptureOptions
  ): Promise<void> {
    const startCapturingPromise = this.startCapturing(
      options ?? this.defaultCaptureOptions
    );
    if (sender) {
      this.startSending(sender);
    }
    // Bubble up the error.
    return startCapturingPromise;
  }

  disable(): void {
    this.stopCapturing();
    this.stopSending();

    if (this.updateLocalPreviewIntervalId !== undefined) {
      clearInterval(this.updateLocalPreviewIntervalId);
    }
    this.updateLocalPreviewIntervalId = undefined;
  }

  async setPreferredDevice(deviceId: string): Promise<void> {
    this.preferredDeviceId = deviceId;

    if (this.captureOptions) {
      const { captureOptions, sender } = this;

      this.disable();
      // Bubble up the error if starting video failed.
      return this.enableCaptureAndSend(sender, captureOptions);
    }
  }

  async enumerateDevices(): Promise<Array<MediaDeviceInfo>> {
    const devices = await window.navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter(d => d.kind === 'videoinput');
    return cameras;
  }

  private async getUserMedia(
    options: GumVideoCaptureOptions
  ): Promise<MediaStream> {
    // Return provided media stream
    if (options.mediaStream) {
      return options.mediaStream;
    }

    if (options.screenShareSourceId !== undefined) {
      const screenshareConstraints: GumTrackConstraints = {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: options.screenShareSourceId,
          maxWidth: options.maxWidth,
          maxHeight: options.maxHeight,
          minFrameRate: 1,
          maxFrameRate: options.maxFramerate,
        },
      };
      return navigator.mediaDevices.getUserMedia({
        audio: false,
        video: screenshareConstraints,
      });
    }

    const preferredDeviceId =
      options.preferredDeviceId ?? this.preferredDeviceId;
    const videoConstraints: GumTrackConstraints = {
      deviceId: {
        exact: preferredDeviceId,
      },
      width: {
        max: options.maxWidth,
        ideal: options.maxWidth,
      },
      height: {
        max: options.maxHeight,
        ideal: options.maxHeight,
      },
      frameRate: {
        max: options.maxFramerate,
        ideal: options.maxFramerate,
      },
    };

    try {
      const exactStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: videoConstraints,
      });
      if (exactStream) {
        return exactStream;
      }
    } catch (e) {
      log.warn(
        `getUserMedia(): Failed with exact constraints: ${e}. Falling back to loose constraints.`
      );
    }

    return navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        ...videoConstraints,
        deviceId: preferredDeviceId,
      },
    });
  }

  private async startCapturing(options: GumVideoCaptureOptions): Promise<void> {
    if (this.capturing()) {
      log.warn('startCapturing(): already capturing');
      return;
    }
    log.info(
      `startCapturing(): ${options.maxWidth}x${options.maxHeight}@${options.maxFramerate}`
    );
    this.captureOptions = options;
    try {
      // If we start/stop/start, we may have concurrent calls to getUserMedia,
      // which is what we want if we're switching from camera to screenshare.
      // But we need to make sure we deal with the fact that things might be
      // different after the await here.
      const mediaStream = await this.getUserMedia(options);
      // It's possible video was disabled, switched to screenshare, or
      // switched to a different camera while awaiting a response, in
      // which case we need to disable the camera we just accessed.
      if (this.captureOptions !== options) {
        log.warn('startCapturing(): different state after getUserMedia()');
        for (const track of mediaStream.getVideoTracks()) {
          // Make the light turn off faster
          track.stop();
        }
        return;
      }

      if (
        this.mediaStream !== undefined &&
        this.mediaStream.getVideoTracks().length > 0
      ) {
        // We have a stream and track for the requested camera already. Stop
        // the duplicate track that we just started.
        log.warn('startCapturing(): dropping duplicate call to startCapturing');
        for (const track of mediaStream.getVideoTracks()) {
          track.stop();
        }
        return;
      }

      this.mediaStream = mediaStream;
      if (
        !this.spawnedSenderRunning &&
        this.mediaStream !== undefined &&
        this.sender !== undefined
      ) {
        this.spawnSender(this.mediaStream, this.sender);
      }

      this.updateLocalPreviewSourceObject();
    } catch (e) {
      log.error(`startCapturing(): ${e}`);

      // It's possible video was disabled, switched to screenshare, or
      // switched to a different camera while awaiting a response, in
      // which case we should reset the captureOptions if we set them.
      if (this.captureOptions === options) {
        // We couldn't open the camera.  Oh well.
        this.captureOptions = undefined;
      }
      // Re-raise so that callers can surface this condition to the user.
      throw e;
    }
  }

  private stopCapturing(): void {
    if (!this.capturing()) {
      log.warn('stopCapturing(): not capturing');
      return;
    }
    log.info('stopCapturing()');
    this.captureOptions = undefined;
    if (this.mediaStream) {
      for (const track of this.mediaStream.getVideoTracks()) {
        // Make the light turn off faster
        track.stop();
      }
      this.mediaStream = undefined;
    }

    this.updateLocalPreviewSourceObject();
  }

  private startSending(sender: VideoFrameSender): void {
    if (this.sender === sender) {
      return;
    }
    if (this.sender) {
      // If we're replacing an existing sender, make sure we stop the
      // current setInterval loop before starting another one.
      this.stopSending();
    }
    this.sender = sender;

    if (!this.spawnedSenderRunning && this.mediaStream !== undefined) {
      this.spawnSender(this.mediaStream, this.sender);
    }
  }

  private spawnSender(mediaStream: MediaStream, sender: VideoFrameSender) {
    const track = mediaStream.getVideoTracks()[0];
    if (track === undefined || this.spawnedSenderRunning) {
      return;
    }

    const { onEnded } = this.captureOptions || {};

    if (track.readyState === 'ended') {
      this.stopCapturing();
      log.warn('spawnSender(): Video track ended before spawning sender');
      return;
    }

    const reader = new MediaStreamTrackProcessor({
      track,
    }).readable.getReader();
    const buffer = new Uint8Array(MAX_VIDEO_CAPTURE_BUFFER_SIZE);
    this.spawnedSenderRunning = true;
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    (async () => {
      try {
        while (mediaStream === this.mediaStream) {
          const { done, value: frame } = await reader.read();
          if (done) {
            break;
          }
          if (!frame) {
            continue;
          }
          try {
            const format = videoPixelFormatToEnum(frame.format ?? 'I420');
            if (format === undefined) {
              log.warn(`Unsupported video frame format: ${frame.format}`);
              break;
            }

            const { width, height } = frame.visibleRect || {};
            if (!width || !height) {
              continue;
            }

            await frame.copyTo(buffer);
            if (sender !== this.sender) {
              break;
            }

            sender.sendVideoFrame(width, height, format, buffer);
          } catch (e) {
            log.error(`sendVideoFrame(): ${e}`);
          } finally {
            // This must be called for more frames to come.
            frame.close();
          }
        }
      } catch (e) {
        log.error(`spawnSender(): ${e}`);
      } finally {
        reader.releaseLock();
        onEnded?.();
      }
      this.spawnedSenderRunning = false;
    })();
  }

  private stopSending(): void {
    // The spawned sender should stop
    this.sender = undefined;
  }

  private updateLocalPreviewSourceObject(): void {
    if (!this.localPreview) {
      return;
    }
    const localPreview = this.localPreview.current;
    if (!localPreview) {
      return;
    }

    const { mediaStream = null } = this;

    if (localPreview.srcObject === mediaStream) {
      return;
    }

    if (mediaStream && this.captureOptions) {
      localPreview.srcObject = mediaStream;
      if (localPreview.width === 0) {
        localPreview.width = this.captureOptions.maxWidth;
      }
      if (localPreview.height === 0) {
        localPreview.height = this.captureOptions.maxHeight;
      }
    } else {
      localPreview.srcObject = null;
    }
  }
}

export const MAX_VIDEO_CAPTURE_WIDTH = 2880;
export const MAX_VIDEO_CAPTURE_HEIGHT = 1800;
export const MAX_VIDEO_CAPTURE_AREA =
  MAX_VIDEO_CAPTURE_WIDTH * MAX_VIDEO_CAPTURE_HEIGHT;
export const MAX_VIDEO_CAPTURE_BUFFER_SIZE = MAX_VIDEO_CAPTURE_AREA * 4;

export class CanvasVideoRenderer {
  private canvas?: RefObject<HTMLCanvasElement>;
  private buffer: Uint8Array;
  private imageData?: ImageData;
  private source?: VideoFrameSource;
  private rafId?: any;

  constructor() {
    this.buffer = new Uint8Array(MAX_VIDEO_CAPTURE_BUFFER_SIZE);
  }

  setCanvas(canvas: RefObject<HTMLCanvasElement> | undefined): void {
    this.canvas = canvas;
  }

  enable(source: VideoFrameSource): void {
    if (this.source === source) {
      return;
    }
    if (this.source) {
      // If we're replacing an existing source, make sure we stop the
      // current rAF loop before starting another one.
      if (this.rafId) {
        window.cancelAnimationFrame(this.rafId);
      }
    }
    this.source = source;
    this.requestAnimationFrameCallback();
  }

  disable(): void {
    this.renderBlack();
    this.source = undefined;
    if (this.rafId) {
      window.cancelAnimationFrame(this.rafId);
    }
  }

  private requestAnimationFrameCallback() {
    this.renderVideoFrame();
    this.rafId = window.requestAnimationFrame(
      this.requestAnimationFrameCallback.bind(this)
    );
  }

  private renderBlack() {
    if (!this.canvas) {
      return;
    }
    const canvas = this.canvas.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    context.fillStyle = 'black';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  private renderVideoFrame() {
    if (!this.source || !this.canvas) {
      return;
    }
    const canvas = this.canvas.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const frame = this.source.receiveVideoFrame(
      this.buffer,
      MAX_VIDEO_CAPTURE_WIDTH,
      MAX_VIDEO_CAPTURE_HEIGHT
    );
    if (!frame) {
      return;
    }
    const [width, height] = frame;

    if (
      canvas.clientWidth <= 0 ||
      width <= 0 ||
      canvas.clientHeight <= 0 ||
      height <= 0
    ) {
      return;
    }

    const frameAspectRatio = width / height;
    const canvasAspectRatio = canvas.clientWidth / canvas.clientHeight;

    let dx = 0;
    let dy = 0;
    if (frameAspectRatio > canvasAspectRatio) {
      // Frame wider than view: We need bars at the top and bottom
      canvas.width = width;
      canvas.height = width / canvasAspectRatio;
      dy = (canvas.height - height) / 2;
    } else if (frameAspectRatio < canvasAspectRatio) {
      // Frame narrower than view: We need pillars on the sides
      canvas.width = height * canvasAspectRatio;
      canvas.height = height;
      dx = (canvas.width - width) / 2;
    } else {
      // Will stretch perfectly with no bars
      canvas.width = width;
      canvas.height = height;
    }

    if (dx > 0 || dy > 0) {
      context.fillStyle = 'black';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (this.imageData?.width !== width || this.imageData?.height !== height) {
      this.imageData = new ImageData(width, height);
    }
    this.imageData.data.set(this.buffer.subarray(0, width * height * 4));
    context.putImageData(this.imageData, dx, dy);
  }
}
