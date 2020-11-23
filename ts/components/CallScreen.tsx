// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { noop } from 'lodash';
import classNames from 'classnames';
import {
  ActiveCallType,
  HangUpType,
  SetLocalAudioType,
  SetLocalPreviewType,
  SetLocalVideoType,
  SetRendererCanvasType,
} from '../state/ducks/calling';
import { Avatar } from './Avatar';
import { CallingHeader } from './CallingHeader';
import { CallingButton, CallingButtonType } from './CallingButton';
import { CallBackgroundBlur } from './CallBackgroundBlur';
import {
  CallMode,
  CallState,
  GroupCallConnectionState,
  VideoFrameSource,
} from '../types/Calling';
import { ColorType } from '../types/Colors';
import { LocalizerType } from '../types/Util';
import { missingCaseError } from '../util/missingCaseError';
import { DirectCallRemoteParticipant } from './DirectCallRemoteParticipant';
import { GroupCallRemoteParticipants } from './GroupCallRemoteParticipants';

export type PropsType = {
  activeCall: ActiveCallType;
  getGroupCallVideoFrameSource: (demuxId: number) => VideoFrameSource;
  hangUp: (_: HangUpType) => void;
  hasLocalAudio: boolean;
  hasLocalVideo: boolean;
  i18n: LocalizerType;
  joinedAt?: number;
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
  stickyControls: boolean;
  toggleParticipants: () => void;
  togglePip: () => void;
  toggleSettings: () => void;
};

export const CallScreen: React.FC<PropsType> = ({
  activeCall,
  getGroupCallVideoFrameSource,
  hangUp,
  hasLocalAudio,
  hasLocalVideo,
  i18n,
  joinedAt,
  me,
  setLocalAudio,
  setLocalVideo,
  setLocalPreview,
  setRendererCanvas,
  stickyControls,
  toggleParticipants,
  togglePip,
  toggleSettings,
}) => {
  const { call, conversation, groupCallParticipants } = activeCall;

  const toggleAudio = useCallback(() => {
    setLocalAudio({
      enabled: !hasLocalAudio,
    });
  }, [setLocalAudio, hasLocalAudio]);

  const toggleVideo = useCallback(() => {
    setLocalVideo({
      enabled: !hasLocalVideo,
    });
  }, [setLocalVideo, hasLocalVideo]);

  const [acceptedDuration, setAcceptedDuration] = useState<number | null>(null);
  const [showControls, setShowControls] = useState(true);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setLocalPreview({ element: localVideoRef });
    return () => {
      setLocalPreview({ element: undefined });
    };
  }, [setLocalPreview, setRendererCanvas]);

  useEffect(() => {
    if (!joinedAt) {
      return noop;
    }
    // It's really jumpy with a value of 500ms.
    const interval = setInterval(() => {
      setAcceptedDuration(Date.now() - joinedAt);
    }, 100);
    return clearInterval.bind(null, interval);
  }, [joinedAt]);

  useEffect(() => {
    if (!showControls || stickyControls) {
      return noop;
    }
    const timer = setTimeout(() => {
      setShowControls(false);
    }, 5000);
    return clearInterval.bind(null, timer);
  }, [showControls, stickyControls]);

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

  let hasRemoteVideo: boolean;
  let headerMessage: string | undefined;
  let headerTitle: string | undefined;
  let isConnected: boolean;
  let participantCount: number;
  let remoteParticipantsElement: JSX.Element;

  switch (call.callMode) {
    case CallMode.Direct:
      hasRemoteVideo = Boolean(call.hasRemoteVideo);
      headerMessage = renderHeaderMessage(
        i18n,
        call.callState || CallState.Prering,
        acceptedDuration
      );
      headerTitle = conversation.title;
      isConnected = call.callState === CallState.Accepted;
      participantCount = isConnected ? 2 : 0;
      remoteParticipantsElement = (
        <DirectCallRemoteParticipant
          conversation={conversation}
          hasRemoteVideo={hasRemoteVideo}
          i18n={i18n}
          setRendererCanvas={setRendererCanvas}
        />
      );
      break;
    case CallMode.Group:
      hasRemoteVideo = call.remoteParticipants.some(
        remoteParticipant => remoteParticipant.hasRemoteVideo
      );
      participantCount = activeCall.groupCallParticipants.length;
      headerMessage = undefined;
      headerTitle = activeCall.groupCallParticipants.length
        ? undefined
        : i18n('calling__in-this-call--zero');
      isConnected = call.connectionState === GroupCallConnectionState.Connected;
      remoteParticipantsElement = (
        <GroupCallRemoteParticipants
          getGroupCallVideoFrameSource={getGroupCallVideoFrameSource}
          i18n={i18n}
          remoteParticipants={groupCallParticipants}
        />
      );
      break;
    default:
      throw missingCaseError(call);
  }

  const videoButtonType = hasLocalVideo
    ? CallingButtonType.VIDEO_ON
    : CallingButtonType.VIDEO_OFF;
  const audioButtonType = hasLocalAudio
    ? CallingButtonType.AUDIO_ON
    : CallingButtonType.AUDIO_OFF;

  const isAudioOnly = !hasLocalVideo && !hasRemoteVideo;

  const controlsFadeClass = classNames({
    'module-ongoing-call__controls--fadeIn':
      (showControls || isAudioOnly) && !isConnected,
    'module-ongoing-call__controls--fadeOut':
      !showControls && !isAudioOnly && isConnected,
  });

  const { showParticipantsList } = activeCall.activeCallState;

  return (
    <div
      className={classNames(
        'module-calling__container',
        `module-ongoing-call__container--${getCallModeClassSuffix(
          call.callMode
        )}`
      )}
      onMouseMove={() => {
        setShowControls(true);
      }}
      role="group"
    >
      <div
        className={classNames('module-ongoing-call__header', controlsFadeClass)}
      >
        <CallingHeader
          canPip
          i18n={i18n}
          isGroupCall={call.callMode === CallMode.Group}
          message={headerMessage}
          remoteParticipants={participantCount}
          showParticipantsList={showParticipantsList}
          title={headerTitle}
          toggleParticipants={toggleParticipants}
          togglePip={togglePip}
          toggleSettings={toggleSettings}
        />
      </div>
      {remoteParticipantsElement}
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
          />
          <CallingButton
            buttonType={audioButtonType}
            i18n={i18n}
            onClick={toggleAudio}
          />
          <CallingButton
            buttonType={CallingButtonType.HANG_UP}
            i18n={i18n}
            onClick={() => {
              hangUp({ conversationId: conversation.id });
            }}
          />
        </div>
        <div
          className={classNames('module-ongoing-call__footer__local-preview', {
            'module-ongoing-call__footer__local-preview--audio-muted': !hasLocalAudio,
          })}
        >
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

function getCallModeClassSuffix(
  callMode: CallMode.Direct | CallMode.Group
): string {
  switch (callMode) {
    case CallMode.Direct:
      return 'direct';
    case CallMode.Group:
      return 'group';
    default:
      throw missingCaseError(callMode);
  }
}

function renderHeaderMessage(
  i18n: LocalizerType,
  callState: CallState,
  acceptedDuration: null | number
): string | undefined {
  let message;
  if (callState === CallState.Prering) {
    message = i18n('outgoingCallPrering');
  } else if (callState === CallState.Ringing) {
    message = i18n('outgoingCallRinging');
  } else if (callState === CallState.Reconnecting) {
    message = i18n('callReconnecting');
  } else if (callState === CallState.Accepted && acceptedDuration) {
    message = i18n('callDuration', [renderDuration(acceptedDuration)]);
  }
  return message;
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
