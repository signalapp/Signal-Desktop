// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useRef, useCallback } from 'react';
import type { LocalizerType } from '../types/Util.std.js';
import { Modal } from './Modal.dom.js';
import { requestCameraPermissions } from '../util/callingPermissions.dom.js';
export type PropsType = {
  i18n: LocalizerType;
  onClose: () => void;
  onCapture: (file: File) => void;
};

export function CameraModal({
  i18n,
  onClose,
  onCapture,
}: PropsType): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    async function startCamera() {
      try {
        const hasPermission = await requestCameraPermissions();
        if (!hasPermission) {
          onClose();
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Camera access error:', err);
        setHasError(true);
      }
    }
    void startCamera();

    return () => {
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, [onClose]);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    //Resolved the bug: Stop the camera stream immediately after capture
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    onClose();

    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], `camera-${Date.now()}.jpg`, {
        type: 'image/jpeg',
      });
      onCapture(file);
      onClose();
    }, 'image/jpeg');
  }, [onCapture, onClose]);

  return (
    <Modal
      modalName="CameraModal"
      i18n={i18n}
      title={i18n('icu:CameraModal__title')}
      hasXButton
      onClose={onClose}
      noMouseClose
    >
      <div className="CameraModal__preview">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="CameraModal__video"
        />
      </div>
      <div className="CameraModal__controls">
        <button
          type="button"
          className="CameraModal__capture"
          onClick={handleCapture}
          aria-label={i18n('icu:CameraModal__capture')}
        />
      </div>
    </Modal>
  );
}
