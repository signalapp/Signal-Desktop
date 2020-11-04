// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { noop } from 'lodash';
import classNames from 'classnames';
import {
  CallDetailsType,
  HangUpType,
  SetLocalAudioType,
  SetLocalPreviewType,
  SetLocalVideoType,
  SetRendererCanvasType,
} from '../state/ducks/calling';
import { Avatar } from './Avatar';
import { CallingButton, CallingButtonType } from './CallingButton';
import { CallBackgroundBlur } from './CallBackgroundBlur';
import { CallState } from '../types/Calling';
import { ColorType } from '../types/Colors';
import { LocalizerType } from '../types/Util';

export type PropsType = {
  callDetails?: CallDetailsType;
  callState?: CallState;
  hangUp: (_: HangUpType) => void;
  hasLocalAudio: boolean;
  hasLocalVideo: boolean;
  hasRemoteVideo: boolean;
  i18n: LocalizerType;
  me: {
    avatarPath?: string;
    color?: ColorType;
    name?: string;
    phoneNumber?: string;
    profileName?: string;
    title: string;
  };
  setLocalAudio: (_: SetLocalAudioType) => void;
  setLocalVideo: (_: SetLocalVideoType) => void;
  setLocalPreview: (_: SetLocalPreviewType) => void;
  setRendererCanvas: (_: SetRendererCanvasType) => void;
  togglePip: () => void;
  toggleSettings: () => void;
};

export const CallScreen: React.FC<PropsType> = ({
  callDetails,
  callState,
  hangUp,
  hasLocalAudio,
  hasLocalVideo,
  hasRemoteVideo,
  i18n,
  me,
  setLocalAudio,
  setLocalVideo,
  setLocalPreview,
  setRendererCanvas,
  togglePip,
  toggleSettings,
}) => {
  const { acceptedTime, callId } = callDetails || {};

  const toggleAudio = useCallback(() => {
    if (!callId) {
      return;
    }

    setLocalAudio({
      callId,
      enabled: !hasLocalAudio,
    });
  }, [callId, setLocalAudio, hasLocalAudio]);

  const toggleVideo = useCallback(() => {
    if (!callId) {
      return;
    }

    setLocalVideo({
      callId,
      enabled: !hasLocalVideo,
    });
  }, [callId, setLocalVideo, hasLocalVideo]);

  const [acceptedDuration, setAcceptedDuration] = useState<number | null>(null);
  const [showControls, setShowControls] = useState(true);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setLocalPreview({ element: localVideoRef });
    setRendererCanvas({ element: remoteVideoRef });

    return () => {
      setLocalPreview({ element: undefined });
      setRendererCanvas({ element: undefined });
    };
  }, [setLocalPreview, setRendererCanvas]);

  useEffect(() => {
    if (!acceptedTime) {
      return noop;
    }
    // It's really jumpy with a value of 500ms.
    const interval = setInterval(() => {
      setAcceptedDuration(Date.now() - acceptedTime);
    }, 100);
    return clearInterval.bind(null, interval);
  }, [acceptedTime]);

  useEffect(() => {
    if (!showControls) {
      return noop;
    }
    const timer = setTimeout(() => {
      setShowControls(false);
    }, 5000);
    return clearInterval.bind(null, timer);
  }, [showControls]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      let eventHandled = false;

      if (event.shiftKey && (event.key === 'V' || event.key === 'v')) {
        toggleVideo();
        eventHandled = true;
      } else if (event.shiftKey && (event.key === 'M' || event.key === 'm')) {
        toggleAudio();
        eventHandled = true;
      }

      if (eventHandled) {
        event.preventDefault();
        event.stopPropagation();
        setShowControls(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleAudio, toggleVideo]);

  const isAudioOnly = !hasLocalVideo && !hasRemoteVideo;

  if (!callDetails || !callState) {
    return null;
  }

  const controlsFadeClass = classNames({
    'module-ongoing-call__controls--fadeIn':
      (showControls || isAudioOnly) && callState !== CallState.Accepted,
    'module-ongoing-call__controls--fadeOut':
      !showControls && !isAudioOnly && callState === CallState.Accepted,
  });

  const videoButtonType = hasLocalVideo
    ? CallingButtonType.VIDEO_ON
    : CallingButtonType.VIDEO_OFF;
  const audioButtonType = hasLocalAudio
    ? CallingButtonType.AUDIO_ON
    : CallingButtonType.AUDIO_OFF;

  return (
    <div
      className="module-calling__container"
      onMouseMove={() => {
        setShowControls(true);
      }}
      role="group"
    >
      <div
        className={classNames(
          'module-calling__header',
          'module-ongoing-call__header',
          controlsFadeClass
        )}
      >
        <div className="module-calling__header--header-name">
          {callDetails.title}
        </div>
        {renderHeaderMessage(i18n, callState, acceptedDuration)}
        <div className="module-calling-tools">
          <button
            type="button"
            aria-label={i18n('callingDeviceSelection__settings')}
            className="module-calling-tools__button module-calling-button__settings"
            onClick={toggleSettings}
          />
          <button
            type="button"
            aria-label={i18n('calling__pip')}
            className="module-calling-tools__button module-calling-button__pip"
            onClick={togglePip}
          />
        </div>
      </div>
      {hasRemoteVideo ? (
        <canvas
          className="module-ongoing-call__remote-video-enabled"
          ref={remoteVideoRef}
        />
      ) : (
        renderAvatar(i18n, callDetails)
      )}
      <div className="module-ongoing-call__footer">
        {/* This layout-only element is not ideal.
            See the comment in _modules.css for more. */}
        <div className="module-ongoing-call__footer__local-preview-offset" />
        <div
          className={classNames(
            'module-ongoing-call__footer__actions',
            controlsFadeClass
          )}
        >
          <CallingButton
            buttonType={videoButtonType}
            i18n={i18n}
            onClick={toggleVideo}
            tooltipDistance={24}
          />
          <CallingButton
            buttonType={audioButtonType}
            i18n={i18n}
            onClick={toggleAudio}
            tooltipDistance={24}
          />
          <CallingButton
            buttonType={CallingButtonType.HANG_UP}
            i18n={i18n}
            onClick={() => {
              hangUp({ callId });
            }}
            tooltipDistance={24}
          />
        </div>
        <div className="module-ongoing-call__footer__local-preview">
          {hasLocalVideo ? (
            <video
              className="module-ongoing-call__footer__local-preview__video"
              ref={localVideoRef}
              autoPlay
            />
          ) : (
            <CallBackgroundBlur avatarPath={me.avatarPath} color={me.color}>
              <Avatar
                avatarPath={me.avatarPath}
                color={me.color || 'ultramarine'}
                noteToSelf={false}
                conversationType="direct"
                i18n={i18n}
                name={me.name}
                phoneNumber={me.phoneNumber}
                profileName={me.profileName}
                title={me.title}
                size={80}
              />
            </CallBackgroundBlur>
          )}
        </div>
      </div>
    </div>
  );
};

function renderAvatar(
  i18n: LocalizerType,
  callDetails: CallDetailsType
): JSX.Element {
  const {
    avatarPath,
    color,
    name,
    phoneNumber,
    profileName,
    title,
  } = callDetails;
  return (
    <div className="module-ongoing-call__remote-video-disabled">
      <Avatar
        avatarPath={avatarPath}
        color={color || 'ultramarine'}
        noteToSelf={false}
        conversationType="direct"
        i18n={i18n}
        name={name}
        phoneNumber={phoneNumber}
        profileName={profileName}
        title={title}
        size={112}
      />
    </div>
  );
}

function renderHeaderMessage(
  i18n: LocalizerType,
  callState: CallState,
  acceptedDuration: null | number
): JSX.Element | null {
  let message = null;
  if (callState === CallState.Prering) {
    message = i18n('outgoingCallPrering');
  } else if (callState === CallState.Ringing) {
    message = i18n('outgoingCallRinging');
  } else if (callState === CallState.Reconnecting) {
    message = i18n('callReconnecting');
  } else if (callState === CallState.Accepted && acceptedDuration) {
    message = i18n('callDuration', [renderDuration(acceptedDuration)]);
  }

  if (!message) {
    return null;
  }
  return <div className="module-ongoing-call__header-message">{message}</div>;
}

function renderDuration(ms: number): string {
  const secs = Math.floor((ms / 1000) % 60)
    .toString()
    .padStart(2, '0');
  const mins = Math.floor((ms / 60000) % 60)
    .toString()
    .padStart(2, '0');
  const hours = Math.floor(ms / 3600000);
  if (hours > 0) {
    return `${hours}:${mins}:${secs}`;
  }
  return `${mins}:${secs}`;
}
