// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import FocusTrap from 'focus-trap-react';
import classNames from 'classnames';
import type {
  SetLocalAudioType,
  SetLocalVideoType,
} from '../state/ducks/calling';
import { CallingButton, CallingButtonType } from './CallingButton';
import { TooltipPlacement } from './Tooltip';
import { CallBackgroundBlur } from './CallBackgroundBlur';
import { CallParticipantCount } from './CallParticipantCount';
import { CallingHeader } from './CallingHeader';
import { CallingPreCallInfo, RingMode } from './CallingPreCallInfo';
import {
  CallingLobbyJoinButton,
  CallingLobbyJoinButtonVariant,
} from './CallingLobbyJoinButton';
import { CallMode } from '../types/CallDisposition';
import type { CallingConversationType } from '../types/Calling';
import type { LocalizerType } from '../types/Util';
import { useIsOnline } from '../hooks/useIsOnline';
import * as KeyboardLayout from '../services/keyboardLayout';
import type { ConversationType } from '../state/ducks/conversations';
import { useCallingToasts } from './CallingToast';
import { CallingButtonToastsContainer } from './CallingToastManager';
import { isGroupOrAdhocCallMode } from '../util/isGroupOrAdhocCall';
import { Button, ButtonVariant } from './Button';
import { SpinnerV2 } from './SpinnerV2';

export type PropsType = {
  availableCameras: Array<MediaDeviceInfo>;
  callMode: CallMode;
  conversation: Pick<
    CallingConversationType,
    | 'acceptedMessageRequest'
    | 'avatarUrl'
    | 'color'
    | 'isMe'
    | 'memberships'
    | 'name'
    | 'phoneNumber'
    | 'profileName'
    | 'sharedGroupNames'
    | 'systemGivenName'
    | 'systemNickname'
    | 'title'
    | 'type'
    | 'unblurredAvatarUrl'
  >;
  getIsSharingPhoneNumberWithEverybody: () => boolean;
  groupMembers?: Array<
    Pick<
      ConversationType,
      'id' | 'firstName' | 'systemGivenName' | 'systemNickname' | 'title'
    >
  >;
  hasLocalAudio: boolean;
  hasLocalVideo: boolean;
  i18n: LocalizerType;
  isAdhocAdminApprovalRequired: boolean;
  isAdhocJoinRequestPending: boolean;
  isConversationTooBigToRing: boolean;
  isCallFull?: boolean;
  me: Readonly<
    Pick<ConversationType, 'avatarUrl' | 'color' | 'id' | 'serviceId'>
  >;
  onCallCanceled: () => void;
  onJoinCall: () => void;
  outgoingRing: boolean;
  peekedParticipants: Array<ConversationType>;
  setLocalAudio: (_: SetLocalAudioType) => void;
  setLocalVideo: (_: SetLocalVideoType) => void;
  setLocalPreviewContainer: (container: HTMLDivElement | null) => void;
  setOutgoingRing: (_: boolean) => void;
  showParticipantsList: boolean;
  toggleParticipants: () => void;
  togglePip: () => void;
  toggleSettings: () => void;
};

export function CallingLobby({
  availableCameras,
  callMode,
  conversation,
  groupMembers,
  hasLocalAudio,
  hasLocalVideo,
  i18n,
  isAdhocAdminApprovalRequired,
  isAdhocJoinRequestPending,
  isCallFull = false,
  isConversationTooBigToRing,
  getIsSharingPhoneNumberWithEverybody,
  me,
  onCallCanceled,
  onJoinCall,
  peekedParticipants,
  setLocalAudio,
  setLocalPreviewContainer,
  setLocalVideo,
  setOutgoingRing,
  toggleParticipants,
  togglePip,
  toggleSettings,
  outgoingRing,
}: PropsType): JSX.Element {
  const shouldShowLocalVideo = hasLocalVideo && availableCameras.length > 0;

  const isGroupOrAdhocCall = isGroupOrAdhocCallMode(callMode);

  const toggleAudio = React.useCallback((): void => {
    setLocalAudio({ enabled: !hasLocalAudio });
  }, [hasLocalAudio, setLocalAudio]);

  const toggleVideo = React.useCallback((): void => {
    setLocalVideo({ enabled: !hasLocalVideo });
  }, [hasLocalVideo, setLocalVideo]);

  const toggleOutgoingRing = React.useCallback((): void => {
    setOutgoingRing(!outgoingRing);
  }, [outgoingRing, setOutgoingRing]);

  const togglePipForCallingHeader = isAdhocJoinRequestPending
    ? togglePip
    : undefined;

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      let eventHandled = false;

      const key = KeyboardLayout.lookup(event);
      if (event.shiftKey && (key === 'V' || key === 'v')) {
        toggleVideo();
        eventHandled = true;
      } else if (event.shiftKey && (key === 'M' || key === 'm')) {
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

  const isOnline = useIsOnline();

  const [isCallConnecting, setIsCallConnecting] = React.useState(
    isAdhocJoinRequestPending || false
  );

  // eslint-disable-next-line no-nested-ternary
  const videoButtonType = hasLocalVideo
    ? CallingButtonType.VIDEO_ON
    : availableCameras.length === 0
      ? CallingButtonType.VIDEO_DISABLED
      : CallingButtonType.VIDEO_OFF;

  const audioButtonType = hasLocalAudio
    ? CallingButtonType.AUDIO_ON
    : CallingButtonType.AUDIO_OFF;

  const isRingButtonVisible: boolean =
    isGroupOrAdhocCall &&
    peekedParticipants.length === 0 &&
    (groupMembers || []).length > 1;

  let preCallInfoRingMode: RingMode;
  if (isGroupOrAdhocCall) {
    preCallInfoRingMode =
      outgoingRing && !isConversationTooBigToRing
        ? RingMode.WillRing
        : RingMode.WillNotRing;
  } else {
    preCallInfoRingMode = RingMode.WillRing;
  }

  let ringButtonType:
    | CallingButtonType.RING_DISABLED
    | CallingButtonType.RING_ON
    | CallingButtonType.RING_OFF;
  if (isRingButtonVisible) {
    if (isConversationTooBigToRing) {
      ringButtonType = CallingButtonType.RING_DISABLED;
    } else if (outgoingRing) {
      ringButtonType = CallingButtonType.RING_ON;
    } else {
      ringButtonType = CallingButtonType.RING_OFF;
    }
  } else {
    ringButtonType = CallingButtonType.RING_DISABLED;
  }

  const canJoin = !isCallFull && !isCallConnecting && isOnline;
  const canLeave =
    (isAdhocAdminApprovalRequired && isCallConnecting) ||
    isAdhocJoinRequestPending;

  let callingLobbyJoinButtonVariant: CallingLobbyJoinButtonVariant;
  if (isCallFull) {
    callingLobbyJoinButtonVariant = CallingLobbyJoinButtonVariant.CallIsFull;
  } else if (isCallConnecting) {
    callingLobbyJoinButtonVariant = CallingLobbyJoinButtonVariant.Loading;
  } else if (isAdhocAdminApprovalRequired) {
    callingLobbyJoinButtonVariant = CallingLobbyJoinButtonVariant.AskToJoin;
  } else if (peekedParticipants.length || callMode === CallMode.Adhoc) {
    callingLobbyJoinButtonVariant = CallingLobbyJoinButtonVariant.Join;
  } else {
    callingLobbyJoinButtonVariant = CallingLobbyJoinButtonVariant.Start;
  }

  const callStatus = React.useMemo(() => {
    if (isGroupOrAdhocCall) {
      return (
        <CallParticipantCount
          callMode={callMode}
          i18n={i18n}
          isAdhocJoinRequestPending={isAdhocJoinRequestPending}
          participantCount={peekedParticipants.length}
          toggleParticipants={toggleParticipants}
        />
      );
    }
    if (hasLocalVideo) {
      return i18n('icu:ContactListItem__menu__video-call');
    }
    if (hasLocalAudio) {
      return i18n('icu:CallControls__InfoDisplay--audio-call');
    }
    return null;
  }, [
    callMode,
    isAdhocJoinRequestPending,
    isGroupOrAdhocCall,
    peekedParticipants.length,
    i18n,
    hasLocalVideo,
    hasLocalAudio,
    toggleParticipants,
  ]);

  useWasInitiallyMutedToast(hasLocalAudio, i18n);

  return (
    <FocusTrap
      focusTrapOptions={{
        allowOutsideClick: ({ target }) => {
          if (!target || !(target instanceof HTMLElement)) {
            return false;
          }
          return target.matches('.Toast, .Toast *');
        },
      }}
    >
      <div className="module-calling__container dark-theme">
        {shouldShowLocalVideo ? (
          <div
            className="module-CallingLobby__local-preview module-CallingLobby__local-preview--camera-is-on"
            ref={setLocalPreviewContainer}
          />
        ) : (
          <CallBackgroundBlur
            className="module-CallingLobby__local-preview module-CallingLobby__local-preview--camera-is-off"
            avatarUrl={me.avatarUrl}
          />
        )}

        <CallingHeader
          i18n={i18n}
          isGroupCall={isGroupOrAdhocCall}
          participantCount={peekedParticipants.length}
          togglePip={togglePipForCallingHeader}
          toggleSettings={toggleSettings}
          onCancel={onCallCanceled}
        />

        <div className="module-calling__spacer module-CallingPreCallInfo-spacer" />
        <CallingPreCallInfo
          conversation={conversation}
          groupMembers={groupMembers}
          i18n={i18n}
          isCallFull={isCallFull}
          me={me}
          peekedParticipants={peekedParticipants}
          ringMode={preCallInfoRingMode}
        />

        <div
          className={classNames(
            'module-calling__camera-is-off module-CallingLobby__camera-is-off',
            `module-CallingLobby__camera-is-off--${
              shouldShowLocalVideo ? 'invisible' : 'visible'
            }`
          )}
        >
          {i18n('icu:calling__your-video-is-off')}
        </div>

        {/* eslint-disable-next-line no-nested-ternary */}
        {callMode === CallMode.Adhoc ? (
          isAdhocJoinRequestPending ? (
            <div className="CallingLobby__CallLinkNotice CallingLobby__CallLinkNotice--join-request-pending">
              <SpinnerV2
                className="CallingLobby__CallLinkJoinRequestPendingSpinner"
                size={16}
                strokeWidth={3}
              />
              {i18n('icu:CallingLobby__CallLinkNotice--join-request-pending')}
            </div>
          ) : (
            <div className="CallingLobby__CallLinkNotice">
              {getIsSharingPhoneNumberWithEverybody()
                ? i18n('icu:CallingLobby__CallLinkNotice--phone-sharing')
                : i18n('icu:CallingLobby__CallLinkNotice')}
            </div>
          )
        ) : null}

        <CallingButtonToastsContainer
          hasLocalAudio={hasLocalAudio}
          outgoingRing={outgoingRing}
          i18n={i18n}
        />
        <div className="CallingLobby__Footer">
          <div className="module-calling__spacer CallControls__OuterSpacer" />
          <div className="CallControls">
            <div className="CallControls__InfoDisplay">
              <div className="CallControls__CallTitle">
                {conversation.title}
              </div>
              <div className="CallControls__Status">{callStatus}</div>
            </div>
            <div className="CallControls__ButtonContainer">
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
              <CallingButton
                buttonType={ringButtonType}
                i18n={i18n}
                isVisible={isRingButtonVisible}
                onClick={toggleOutgoingRing}
                tooltipDirection={TooltipPlacement.Top}
              />
            </div>
            <div className="CallControls__JoinLeaveButtonContainer">
              {canLeave ? (
                <Button
                  className="CallControls__JoinLeaveButton CallControls__JoinLeaveButton--hangup"
                  onClick={onCallCanceled}
                  variant={ButtonVariant.Destructive}
                >
                  {i18n('icu:CallControls__JoinLeaveButton--hangup-group')}
                </Button>
              ) : (
                <CallingLobbyJoinButton
                  disabled={!canJoin}
                  i18n={i18n}
                  onClick={() => {
                    setIsCallConnecting(true);
                    onJoinCall();
                  }}
                  variant={callingLobbyJoinButtonVariant}
                />
              )}
            </div>
          </div>
          <div className="module-calling__spacer CallControls__OuterSpacer" />
        </div>
      </div>
    </FocusTrap>
  );
}

function useWasInitiallyMutedToast(
  hasLocalAudio: boolean,
  i18n: LocalizerType
) {
  const [wasInitiallyMuted] = React.useState(!hasLocalAudio);
  const { showToast, hideToast } = useCallingToasts();
  const INITIALLY_MUTED_KEY = 'initially-muted-group-size';
  React.useEffect(() => {
    if (wasInitiallyMuted) {
      showToast({
        key: INITIALLY_MUTED_KEY,
        content: i18n(
          'icu:calling__lobby-automatically-muted-because-there-are-a-lot-of-people'
        ),
        autoClose: true,
        dismissable: true,
        onlyShowOnce: true,
      });
    }
  }, [wasInitiallyMuted, i18n, showToast]);

  // Hide this toast if the user unmutes
  React.useEffect(() => {
    if (wasInitiallyMuted && hasLocalAudio) {
      hideToast(INITIALLY_MUTED_KEY);
    }
  }, [hideToast, wasInitiallyMuted, hasLocalAudio]);
}
