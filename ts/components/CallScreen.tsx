// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { noop } from 'lodash';
import classNames from 'classnames';
import {
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
  ActiveCallType,
  CallMode,
  CallState,
  GroupCallConnectionState,
  GroupCallVideoRequest,
  PresentedSource,
  VideoFrameSource,
} from '../types/Calling';
import { CallingToastManager } from './CallingToastManager';
import { ColorType } from '../types/Colors';
import { DirectCallRemoteParticipant } from './DirectCallRemoteParticipant';
import { GroupCallRemoteParticipants } from './GroupCallRemoteParticipants';
import { LocalizerType } from '../types/Util';
import { isScreenSharingEnabled } from '../util/isScreenSharingEnabled';
import { missingCaseError } from '../util/missingCaseError';
import { useActivateSpeakerViewOnPresenting } from '../hooks/useActivateSpeakerViewOnPresenting';
import { NeedsScreenRecordingPermissionsModal } from './NeedsScreenRecordingPermissionsModal';

export type PropsType = {
  activeCall: ActiveCallType;
  getGroupCallVideoFrameSource: (demuxId: number) => VideoFrameSource;
  getPresentingSources: () => void;
  hangUp: (_: HangUpType) => void;
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
  openSystemPreferencesAction: () => unknown;
  setGroupCallVideoRequest: (_: Array<GroupCallVideoRequest>) => void;
  setLocalAudio: (_: SetLocalAudioType) => void;
  setLocalVideo: (_: SetLocalVideoType) => void;
  setLocalPreview: (_: SetLocalPreviewType) => void;
  setPresenting: (_?: PresentedSource) => void;
  setRendererCanvas: (_: SetRendererCanvasType) => void;
  stickyControls: boolean;
  toggleParticipants: () => void;
  togglePip: () => void;
  toggleScreenRecordingPermissionsDialog: () => unknown;
  toggleSettings: () => void;
  toggleSpeakerView: () => void;
};

export const CallScreen: React.FC<PropsType> = ({
  activeCall,
  getGroupCallVideoFrameSource,
  getPresentingSources,
  hangUp,
  i18n,
  joinedAt,
  me,
  openSystemPreferencesAction,
  setGroupCallVideoRequest,
  setLocalAudio,
  setLocalVideo,
  setLocalPreview,
  setPresenting,
  setRendererCanvas,
  stickyControls,
  toggleParticipants,
  togglePip,
  toggleScreenRecordingPermissionsDialog,
  toggleSettings,
  toggleSpeakerView,
}) => {
  const {
    conversation,
    hasLocalAudio,
    hasLocalVideo,
    isInSpeakerView,
    presentingSource,
    remoteParticipants,
    showNeedsScreenRecordingPermissionsWarning,
    showParticipantsList,
  } = activeCall;

  useActivateSpeakerViewOnPresenting(
    remoteParticipants,
    isInSpeakerView,
    toggleSpeakerView
  );

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

  const togglePresenting = useCallback(() => {
    if (presentingSource) {
      setPresenting();
    } else {
      getPresentingSources();
    }
  }, [getPresentingSources, presentingSource, setPresenting]);

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

  const currentPresenter = remoteParticipants.find(
    participant => participant.presenting
  );

  const hasRemoteVideo = remoteParticipants.some(
    remoteParticipant => remoteParticipant.hasRemoteVideo
  );

  let headerMessage: string | undefined;
  let headerTitle: string | undefined;
  let isConnected: boolean;
  let participantCount: number;
  let remoteParticipantsElement: JSX.Element;

  switch (activeCall.callMode) {
    case CallMode.Direct:
      headerMessage = renderHeaderMessage(
        i18n,
        activeCall.callState || CallState.Prering,
        acceptedDuration
      );
      headerTitle = conversation.title;
      isConnected = activeCall.callState === CallState.Accepted;
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
      participantCount = activeCall.remoteParticipants.length + 1;
      headerMessage = undefined;

      if (currentPresenter) {
        headerTitle = i18n('calling__presenting--person-ongoing', [
          currentPresenter.title,
        ]);
      } else if (!activeCall.remoteParticipants.length) {
        headerTitle = i18n('calling__in-this-call--zero');
      }

      isConnected =
        activeCall.connectionState === GroupCallConnectionState.Connected;
      remoteParticipantsElement = (
        <GroupCallRemoteParticipants
          getGroupCallVideoFrameSource={getGroupCallVideoFrameSource}
          i18n={i18n}
          isInSpeakerView={isInSpeakerView}
          remoteParticipants={activeCall.remoteParticipants}
          setGroupCallVideoRequest={setGroupCallVideoRequest}
        />
      );
      break;
    default:
      throw missingCaseError(activeCall);
  }

  const isLonelyInGroup =
    activeCall.callMode === CallMode.Group &&
    !activeCall.remoteParticipants.length;

  let videoButtonType: CallingButtonType;
  if (presentingSource) {
    videoButtonType = CallingButtonType.VIDEO_DISABLED;
  } else if (hasLocalVideo) {
    videoButtonType = CallingButtonType.VIDEO_ON;
  } else {
    videoButtonType = CallingButtonType.VIDEO_OFF;
  }

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

  const isGroupCall = activeCall.callMode === CallMode.Group;
  const localPreviewVideoClass = classNames({
    'module-ongoing-call__footer__local-preview__video': true,
    'module-ongoing-call__footer__local-preview__video--presenting': Boolean(
      presentingSource
    ),
  });

  let presentingButtonType: CallingButtonType;
  if (presentingSource) {
    presentingButtonType = CallingButtonType.PRESENTING_ON;
  } else if (currentPresenter) {
    presentingButtonType = CallingButtonType.PRESENTING_DISABLED;
  } else {
    presentingButtonType = CallingButtonType.PRESENTING_OFF;
  }

  return (
    <div
      className={classNames(
        'module-calling__container',
        `module-ongoing-call__container--${getCallModeClassSuffix(
          activeCall.callMode
        )}`
      )}
      onMouseMove={() => {
        setShowControls(true);
      }}
      role="group"
    >
      {showNeedsScreenRecordingPermissionsWarning ? (
        <NeedsScreenRecordingPermissionsModal
          toggleScreenRecordingPermissionsDialog={
            toggleScreenRecordingPermissionsDialog
          }
          i18n={i18n}
          openSystemPreferencesAction={openSystemPreferencesAction}
        />
      ) : null}
      <CallingToastManager activeCall={activeCall} i18n={i18n} />
      <div
        className={classNames('module-ongoing-call__header', controlsFadeClass)}
      >
        <CallingHeader
          canPip
          i18n={i18n}
          isInSpeakerView={isInSpeakerView}
          isGroupCall={isGroupCall}
          message={headerMessage}
          participantCount={participantCount}
          showParticipantsList={showParticipantsList}
          title={headerTitle}
          toggleParticipants={toggleParticipants}
          togglePip={togglePip}
          toggleSettings={toggleSettings}
          toggleSpeakerView={toggleSpeakerView}
        />
      </div>
      {remoteParticipantsElement}
      {hasLocalVideo && isLonelyInGroup ? (
        <div className="module-ongoing-call__local-preview-fullsize">
          <video
            className={localPreviewVideoClass}
            ref={localVideoRef}
            autoPlay
          />
        </div>
      ) : null}
      {!hasLocalVideo && isLonelyInGroup ? (
        <div className="module-ongoing-call__local-preview-fullsize">
          <CallBackgroundBlur avatarPath={me.avatarPath} color={me.color}>
            <Avatar
              acceptedMessageRequest
              avatarPath={me.avatarPath}
              color={me.color || 'ultramarine'}
              noteToSelf={false}
              conversationType="direct"
              i18n={i18n}
              isMe
              name={me.name}
              phoneNumber={me.phoneNumber}
              profileName={me.profileName}
              title={me.title}
              // `sharedGroupNames` makes no sense for yourself, but `<Avatar>` needs it
              //   to determine blurring.
              sharedGroupNames={[]}
              size={80}
            />
            <div className="module-calling__video-off--container">
              <div className="module-calling__video-off--icon" />
              <span className="module-calling__video-off--text">
                {i18n('calling__your-video-is-off')}
              </span>
            </div>
          </CallBackgroundBlur>
        </div>
      ) : null}
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
          {isScreenSharingEnabled() ? (
            <CallingButton
              buttonType={presentingButtonType}
              i18n={i18n}
              onClick={togglePresenting}
            />
          ) : null}
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
          {hasLocalVideo && !isLonelyInGroup ? (
            <video
              className={localPreviewVideoClass}
              ref={localVideoRef}
              autoPlay
            />
          ) : null}
          {!hasLocalVideo && !isLonelyInGroup ? (
            <CallBackgroundBlur avatarPath={me.avatarPath} color={me.color}>
              <Avatar
                acceptedMessageRequest
                avatarPath={me.avatarPath}
                color={me.color || 'ultramarine'}
                noteToSelf={false}
                conversationType="direct"
                i18n={i18n}
                isMe
                name={me.name}
                phoneNumber={me.phoneNumber}
                profileName={me.profileName}
                title={me.title}
                // See comment above about `sharedGroupNames`.
                sharedGroupNames={[]}
                size={80}
              />
            </CallBackgroundBlur>
          ) : null}
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
