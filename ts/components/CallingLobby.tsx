// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { ReactNode } from 'react';
import Measure from 'react-measure';
import { debounce } from 'lodash';
import {
  SetLocalAudioType,
  SetLocalPreviewType,
  SetLocalVideoType,
} from '../state/ducks/calling';
import { CallingButton, CallingButtonType } from './CallingButton';
import { TooltipPlacement } from './Tooltip';
import { CallBackgroundBlur } from './CallBackgroundBlur';
import { CallingHeader } from './CallingHeader';
import { Spinner } from './Spinner';
import { ColorType } from '../types/Colors';
import { LocalizerType } from '../types/Util';
import { ConversationType } from '../state/ducks/conversations';
import {
  REQUESTED_VIDEO_WIDTH,
  REQUESTED_VIDEO_HEIGHT,
} from '../calling/constants';

// We request dimensions but may not get them depending on the user's webcam. This is our
//   fallback while we don't know.
const VIDEO_ASPECT_RATIO_FALLBACK =
  REQUESTED_VIDEO_WIDTH / REQUESTED_VIDEO_HEIGHT;

export type PropsType = {
  availableCameras: Array<MediaDeviceInfo>;
  conversation: {
    title: string;
  };
  hasLocalAudio: boolean;
  hasLocalVideo: boolean;
  i18n: LocalizerType;
  isGroupCall: boolean;
  isCallFull?: boolean;
  me: {
    avatarPath?: string;
    color?: ColorType;
    uuid: string;
  };
  onCallCanceled: () => void;
  onJoinCall: () => void;
  peekedParticipants: Array<ConversationType>;
  setLocalAudio: (_: SetLocalAudioType) => void;
  setLocalVideo: (_: SetLocalVideoType) => void;
  setLocalPreview: (_: SetLocalPreviewType) => void;
  showParticipantsList: boolean;
  toggleParticipants: () => void;
  toggleSettings: () => void;
};

export const CallingLobby = ({
  availableCameras,
  conversation,
  hasLocalAudio,
  hasLocalVideo,
  i18n,
  isGroupCall = false,
  isCallFull = false,
  me,
  onCallCanceled,
  onJoinCall,
  peekedParticipants,
  setLocalAudio,
  setLocalPreview,
  setLocalVideo,
  showParticipantsList,
  toggleParticipants,
  toggleSettings,
}: PropsType): JSX.Element => {
  const [
    localPreviewContainerWidth,
    setLocalPreviewContainerWidth,
  ] = React.useState<null | number>(null);
  const [
    localPreviewContainerHeight,
    setLocalPreviewContainerHeight,
  ] = React.useState<null | number>(null);
  const [localVideoAspectRatio, setLocalVideoAspectRatio] = React.useState(
    VIDEO_ASPECT_RATIO_FALLBACK
  );
  const localVideoRef = React.useRef<null | HTMLVideoElement>(null);

  const toggleAudio = React.useCallback((): void => {
    setLocalAudio({ enabled: !hasLocalAudio });
  }, [hasLocalAudio, setLocalAudio]);

  const toggleVideo = React.useCallback((): void => {
    setLocalVideo({ enabled: !hasLocalVideo });
  }, [hasLocalVideo, setLocalVideo]);

  const hasEverMeasured =
    localPreviewContainerWidth !== null && localPreviewContainerHeight !== null;
  const setLocalPreviewContainerDimensions = React.useMemo(() => {
    const set = (bounds: Readonly<{ width: number; height: number }>) => {
      setLocalPreviewContainerWidth(bounds.width);
      setLocalPreviewContainerHeight(bounds.height);
    };

    if (hasEverMeasured) {
      return debounce(set, 100, { maxWait: 3000 });
    }
    return set;
  }, [
    hasEverMeasured,
    setLocalPreviewContainerWidth,
    setLocalPreviewContainerHeight,
  ]);

  React.useEffect(() => {
    setLocalPreview({ element: localVideoRef });

    return () => {
      setLocalPreview({ element: undefined });
    };
  }, [setLocalPreview]);

  // This isn't perfect because it doesn't react to changes in the webcam's aspect ratio.
  //   For example, if you changed from Webcam A to Webcam B and Webcam B had a different
  //   aspect ratio, we wouldn't update.
  //
  // Unfortunately, RingRTC (1) doesn't update these dimensions with the "real" camera
  //   dimensions (2) doesn't give us any hooks or callbacks. For now, this works okay.
  //   We have `object-fit: contain` in the CSS in case we're wrong; not ideal, but
  //   usable.
  React.useEffect(() => {
    const videoEl = localVideoRef.current;
    if (hasLocalVideo && videoEl && videoEl.width && videoEl.height) {
      setLocalVideoAspectRatio(videoEl.width / videoEl.height);
    }
  }, [hasLocalVideo, setLocalVideoAspectRatio]);

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

  const [isCallConnecting, setIsCallConnecting] = React.useState(false);

  // eslint-disable-next-line no-nested-ternary
  const videoButtonType = hasLocalVideo
    ? CallingButtonType.VIDEO_ON
    : availableCameras.length === 0
    ? CallingButtonType.VIDEO_DISABLED
    : CallingButtonType.VIDEO_OFF;
  const audioButtonType = hasLocalAudio
    ? CallingButtonType.AUDIO_ON
    : CallingButtonType.AUDIO_OFF;

  // It should be rare to see yourself in this list, but it's possible if (1) you rejoin
  //   quickly, causing the server to return stale state (2) you have joined on another
  //   device.
  const participantNames = peekedParticipants.map(participant =>
    participant.uuid === me.uuid
      ? i18n('you')
      : participant.firstName || participant.title
  );
  const hasYou = peekedParticipants.some(
    participant => participant.uuid === me.uuid
  );

  const canJoin = !isCallFull && !isCallConnecting;

  let joinButtonChildren: ReactNode;
  if (isCallFull) {
    joinButtonChildren = i18n('calling__call-is-full');
  } else if (isCallConnecting) {
    joinButtonChildren = <Spinner svgSize="small" />;
  } else if (peekedParticipants.length) {
    joinButtonChildren = i18n('calling__join');
  } else {
    joinButtonChildren = i18n('calling__start');
  }

  let localPreviewStyles: React.CSSProperties;
  // It'd be nice to use `hasEverMeasured` here, too, but TypeScript isn't smart enough
  //   to understand the logic here.
  if (
    localPreviewContainerWidth !== null &&
    localPreviewContainerHeight !== null
  ) {
    const containerAspectRatio =
      localPreviewContainerWidth / localPreviewContainerHeight;
    localPreviewStyles =
      containerAspectRatio < localVideoAspectRatio
        ? {
            width: '100%',
            height: Math.floor(
              localPreviewContainerWidth / localVideoAspectRatio
            ),
          }
        : {
            width: Math.floor(
              localPreviewContainerHeight * localVideoAspectRatio
            ),
            height: '100%',
          };
  } else {
    localPreviewStyles = { display: 'none' };
  }

  return (
    <div className="module-calling__container">
      <CallingHeader
        title={conversation.title}
        i18n={i18n}
        isGroupCall={isGroupCall}
        participantCount={peekedParticipants.length}
        showParticipantsList={showParticipantsList}
        toggleParticipants={toggleParticipants}
        toggleSettings={toggleSettings}
      />

      <Measure
        bounds
        onResize={({ bounds }) => {
          if (!bounds) {
            window.log.error('We should be measuring bounds');
            return;
          }
          setLocalPreviewContainerDimensions(bounds);
        }}
      >
        {({ measureRef }) => (
          <div
            ref={measureRef}
            className="module-calling-lobby__local-preview-container"
          >
            <div
              className="module-calling-lobby__local-preview"
              style={localPreviewStyles}
            >
              {hasLocalVideo && availableCameras.length > 0 ? (
                <video
                  className="module-calling-lobby__local-preview__video-on"
                  ref={localVideoRef}
                  autoPlay
                />
              ) : (
                <CallBackgroundBlur avatarPath={me.avatarPath} color={me.color}>
                  <div className="module-calling-lobby__local-preview__video-off__icon" />
                  <span className="module-calling-lobby__local-preview__video-off__text">
                    {i18n('calling__your-video-is-off')}
                  </span>
                </CallBackgroundBlur>
              )}

              <div className="module-calling__buttons">
                <CallingButton
                  buttonType={videoButtonType}
                  i18n={i18n}
                  onClick={toggleVideo}
                  tooltipDirection={TooltipPlacement.Top}
                />
                <CallingButton
                  buttonType={audioButtonType}
                  i18n={i18n}
                  onClick={toggleAudio}
                  tooltipDirection={TooltipPlacement.Top}
                />
              </div>
            </div>
          </div>
        )}
      </Measure>

      {isGroupCall ? (
        <div className="module-calling-lobby__info">
          {participantNames.length === 0 &&
            i18n('calling__lobby-summary--zero')}
          {participantNames.length === 1 &&
            hasYou &&
            i18n('calling__lobby-summary--self')}
          {participantNames.length === 1 &&
            !hasYou &&
            i18n('calling__lobby-summary--single', participantNames)}
          {participantNames.length === 2 &&
            i18n('calling__lobby-summary--double', {
              first: participantNames[0],
              second: participantNames[1],
            })}
          {participantNames.length === 3 &&
            i18n('calling__lobby-summary--triple', {
              first: participantNames[0],
              second: participantNames[1],
              third: participantNames[2],
            })}
          {participantNames.length > 3 &&
            i18n('calling__lobby-summary--many', {
              first: participantNames[0],
              second: participantNames[1],
              others: String(participantNames.length - 2),
            })}
        </div>
      ) : null}

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
          disabled={!canJoin}
          onClick={
            canJoin
              ? () => {
                  setIsCallConnecting(true);
                  onJoinCall();
                }
              : undefined
          }
          tabIndex={0}
          type="button"
        >
          {joinButtonChildren}
        </button>
      </div>
    </div>
  );
};
