import React from 'react';
import {
  CallDetailsType,
  SetLocalAudioType,
  SetLocalPreviewType,
  SetLocalVideoType,
} from '../state/ducks/calling';
import { CallState } from '../types/Calling';
import {
  CallingButton,
  CallingButtonType,
  TooltipDirection,
} from './CallingButton';
import { CallBackgroundBlur } from './CallBackgroundBlur';
import { LocalizerType } from '../types/Util';

export type PropsType = {
  availableCameras: Array<MediaDeviceInfo>;
  callDetails: CallDetailsType;
  callState?: CallState;
  hasLocalAudio: boolean;
  hasLocalVideo: boolean;
  i18n: LocalizerType;
  isGroupCall: boolean;
  onCallCanceled: () => void;
  onJoinCall: () => void;
  setLocalAudio: (_: SetLocalAudioType) => void;
  setLocalVideo: (_: SetLocalVideoType) => void;
  setLocalPreview: (_: SetLocalPreviewType) => void;
  toggleParticipants: () => void;
  toggleSettings: () => void;
};

export const CallingLobby = ({
  availableCameras,
  callDetails,
  hasLocalAudio,
  hasLocalVideo,
  i18n,
  isGroupCall = false,
  onCallCanceled,
  onJoinCall,
  setLocalAudio,
  setLocalPreview,
  setLocalVideo,
  toggleParticipants,
  toggleSettings,
}: PropsType): JSX.Element => {
  const localVideoRef = React.useRef(null);

  const toggleAudio = React.useCallback((): void => {
    if (!callDetails) {
      return;
    }

    setLocalAudio({ enabled: !hasLocalAudio });
  }, [callDetails, hasLocalAudio, setLocalAudio]);

  const toggleVideo = React.useCallback((): void => {
    if (!callDetails) {
      return;
    }

    setLocalVideo({ enabled: !hasLocalVideo });
  }, [callDetails, hasLocalVideo, setLocalVideo]);

  React.useEffect(() => {
    setLocalPreview({ element: localVideoRef });

    return () => {
      setLocalPreview({ element: undefined });
    };
  }, [setLocalPreview]);

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
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
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleVideo, toggleAudio]);

  // eslint-disable-next-line no-nested-ternary
  const videoButtonType = hasLocalVideo
    ? CallingButtonType.VIDEO_ON
    : availableCameras.length === 0
    ? CallingButtonType.VIDEO_DISABLED
    : CallingButtonType.VIDEO_OFF;
  const audioButtonType = hasLocalAudio
    ? CallingButtonType.AUDIO_ON
    : CallingButtonType.AUDIO_OFF;

  return (
    <div className="module-calling__container">
      <div className="module-calling__header">
        <div className="module-calling__header--header-name">
          {callDetails.title}
        </div>
        <div className="module-calling-tools">
          {isGroupCall ? (
            <button
              type="button"
              aria-label={i18n('calling__participants')}
              className="module-calling-tools__button module-calling-button__participants"
              onClick={toggleParticipants}
            />
          ) : null}
          <button
            type="button"
            aria-label={i18n('callingDeviceSelection__settings')}
            className="module-calling-tools__button module-calling-button__settings"
            onClick={toggleSettings}
          />
        </div>
      </div>
      <div className="module-calling-lobby__video">
        {hasLocalVideo && availableCameras.length > 0 ? (
          <video ref={localVideoRef} autoPlay />
        ) : (
          <CallBackgroundBlur
            avatarPath={callDetails.avatarPath}
            color={callDetails.color}
          >
            <div className="module-calling-lobby__video-off--icon" />
            <span className="module-calling-lobby__video-off--text">
              {i18n('calling__your-video-is-off')}
            </span>
          </CallBackgroundBlur>
        )}

        <div className="module-calling__buttons">
          <CallingButton
            buttonType={videoButtonType}
            i18n={i18n}
            onClick={toggleVideo}
            tooltipDirection={TooltipDirection.UP}
            tooltipDistance={24}
          />
          <CallingButton
            buttonType={audioButtonType}
            i18n={i18n}
            onClick={toggleAudio}
            tooltipDirection={TooltipDirection.UP}
            tooltipDistance={24}
          />
        </div>
      </div>

      <div className="module-calling-lobby__actions">
        <button
          className="module-button__gray module-calling-lobby__button"
          onClick={onCallCanceled}
          tabIndex={0}
          type="button"
        >
          {i18n('cancel')}
        </button>
        <button
          className="module-button__green module-calling-lobby__button"
          onClick={onJoinCall}
          tabIndex={0}
          type="button"
        >
          {isGroupCall ? i18n('calling__join') : i18n('calling__start')}
        </button>
      </div>
    </div>
  );
};
