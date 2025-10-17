// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import lodash from 'lodash';
import classNames from 'classnames';
import type { VideoFrameSource } from '@signalapp/ringrtc';
import type {
  ActiveCallStateType,
  BatchUserActionPayloadType,
  PendingUserActionPayloadType,
  SendGroupCallRaiseHandType,
  SendGroupCallReactionType,
  SetLocalAudioType,
  SetLocalVideoType,
  SetRendererCanvasType,
  SetMutedByType,
} from '../state/ducks/calling.preload.js';
import { Avatar, AvatarSize } from './Avatar.dom.js';
import {
  CallingHeader,
  getCallViewIconClassname,
} from './CallingHeader.dom.js';
import { CallingPreCallInfo, RingMode } from './CallingPreCallInfo.dom.js';
import { CallingButton, CallingButtonType } from './CallingButton.dom.js';
import { Button, ButtonVariant } from './Button.dom.js';
import { TooltipPlacement } from './Tooltip.dom.js';
import { CallBackgroundBlur } from './CallBackgroundBlur.dom.js';
import type {
  ActiveCallType,
  ActiveCallReactionsType,
  ConversationsByDemuxIdType,
  GroupCallVideoRequest,
} from '../types/Calling.std.js';
import {
  CALLING_REACTIONS_LIFETIME,
  CallViewMode,
  CallState,
  GroupCallConnectionState,
  GroupCallJoinState,
} from '../types/Calling.std.js';
import { CallMode } from '../types/CallDisposition.std.js';
import type { ServiceIdString } from '../types/ServiceId.std.js';
import { AvatarColors } from '../types/Colors.std.js';
import type { ConversationType } from '../state/ducks/conversations.preload.js';
import {
  CallingButtonToastsContainer,
  useScreenSharingStoppedToast,
} from './CallingToastManager.dom.js';
import { DirectCallRemoteParticipant } from './DirectCallRemoteParticipant.dom.js';
import { GroupCallRemoteParticipants } from './GroupCallRemoteParticipants.dom.js';
import { CallParticipantCount } from './CallParticipantCount.dom.js';
import type { LocalizerType } from '../types/Util.std.js';
import { NeedsScreenRecordingPermissionsModal } from './NeedsScreenRecordingPermissionsModal.dom.js';
import { missingCaseError } from '../util/missingCaseError.std.js';
import * as KeyboardLayout from '../services/keyboardLayout.dom.js';
import {
  usePresenter,
  useActivateSpeakerViewOnPresenting,
} from '../hooks/useActivateSpeakerViewOnPresenting.std.js';
import {
  CallingAudioIndicator,
  SPEAKING_LINGER_MS,
} from './CallingAudioIndicator.dom.js';
import {
  useActiveCallShortcuts,
  useKeyboardShortcuts,
} from '../hooks/useKeyboardShortcuts.dom.js';
import { useValueAtFixedRate } from '../hooks/useValueAtFixedRate.std.js';
import { isReconnecting as callingIsReconnecting } from '../util/callingIsReconnecting.std.js';
import { usePrevious } from '../hooks/usePrevious.std.js';
import {
  CallingToastProvider,
  PersistentCallingToast,
  useCallingToasts,
} from './CallingToast.dom.js';
import { handleOutsideClick } from '../util/handleOutsideClick.dom.js';
import { Spinner } from './Spinner.dom.js';
import type { SmartReactionPicker } from '../state/smart/ReactionPicker.dom.js';
import {
  CallingRaisedHandsList,
  CallingRaisedHandsListButton,
} from './CallingRaisedHandsList.dom.js';
import type { CallReactionBurstType } from './CallReactionBurst.dom.js';
import {
  CallReactionBurstProvider,
  useCallReactionBursts,
} from './CallReactionBurst.dom.js';
import { isGroupOrAdhocActiveCall } from '../util/isGroupOrAdhocCall.std.js';
import { assertDev, strictAssert } from '../util/assert.std.js';
import { CallingPendingParticipants } from './CallingPendingParticipants.dom.js';
import type { CallingImageDataCache } from './CallManager.dom.js';
import { FunStaticEmoji } from './fun/FunEmoji.dom.js';
import {
  getEmojiParentByKey,
  getEmojiParentKeyByVariantKey,
  getEmojiVariantByKey,
  getEmojiVariantKeyByValue,
  isEmojiVariantValue,
} from './fun/data/emojis.std.js';
import { useFunEmojiLocalizer } from './fun/useFunEmojiLocalizer.dom.js';
import {
  BeforeNavigateResponse,
  beforeNavigateService,
} from '../services/BeforeNavigate.std.js';

const { isEqual, noop } = lodash;

export type PropsType = {
  activeCall: ActiveCallType;
  approveUser: (payload: PendingUserActionPayloadType) => void;
  batchUserAction: (payload: BatchUserActionPayloadType) => void;
  cancelPresenting: () => void;
  denyUser: (payload: PendingUserActionPayloadType) => void;
  getGroupCallVideoFrameSource: (demuxId: number) => VideoFrameSource;
  getPresentingSources: () => void;
  groupMembers?: Array<Pick<ConversationType, 'id' | 'firstName' | 'title'>>;
  hangUpActiveCall: (reason: string) => void;
  i18n: LocalizerType;
  imageDataCache: React.RefObject<CallingImageDataCache>;
  isCallLinkAdmin: boolean;
  me: ConversationType;
  openSystemPreferencesAction: () => unknown;
  renderReactionPicker: (
    props: React.ComponentProps<typeof SmartReactionPicker>
  ) => JSX.Element;
  sendGroupCallRaiseHand: (payload: SendGroupCallRaiseHandType) => void;
  sendGroupCallReaction: (payload: SendGroupCallReactionType) => void;
  setGroupCallVideoRequest: (
    _: Array<GroupCallVideoRequest>,
    speakerHeight: number
  ) => void;
  setLocalAudio: SetLocalAudioType;
  setLocalVideo: SetLocalVideoType;
  setLocalPreviewContainer: (container: HTMLDivElement | null) => void;
  setRendererCanvas: (_: SetRendererCanvasType) => void;
  stickyControls: boolean;
  switchToPresentationView: () => void;
  switchFromPresentationView: () => void;
  toggleCallLinkPendingParticipantModal: (contactId: string) => void;
  toggleParticipants: () => void;
  togglePip: () => void;
  toggleScreenRecordingPermissionsDialog: () => unknown;
  toggleSelfViewExpanded: () => void;
  toggleSettings: () => void;
  changeCallView: (mode: CallViewMode) => void;
  setLocalAudioRemoteMuted: SetMutedByType;
};

export const isInSpeakerView = (
  call: Pick<ActiveCallStateType, 'viewMode'> | undefined
): boolean => {
  return Boolean(
    call?.viewMode === CallViewMode.Presentation ||
      call?.viewMode === CallViewMode.Speaker
  );
};

const REACTIONS_TOASTS_TRANSITION_FROM = {
  opacity: 0,
};

// How many reactions of the same emoji must occur before a burst.
const REACTIONS_BURST_THRESHOLD = 3;

// Timeframe in which multiple of the same emoji must occur before a burst.
const REACTIONS_BURST_WINDOW = 4000;

// Timeframe after a burst where new reactions of the same emoji are ignored for
// bursting. They are considered part of the recent burst.
const REACTIONS_BURST_TRAILING_WINDOW = 2000;

// Max number of bursts in a short timeframe to avoid overwhelming the user.
const REACTIONS_BURST_MAX_IN_SHORT_WINDOW = 3;
const REACTIONS_BURST_SHORT_WINDOW = 4000;

function CallDuration({
  joinedAt,
}: {
  joinedAt: number | null;
}): JSX.Element | null {
  const [acceptedDuration, setAcceptedDuration] = useState<
    number | undefined
  >();

  useEffect(() => {
    if (joinedAt == null) {
      return noop;
    }
    // It's really jumpy with a value of 500ms.
    const interval = setInterval(() => {
      setAcceptedDuration(Date.now() - joinedAt);
    }, 100);
    return clearInterval.bind(null, interval);
  }, [joinedAt]);

  if (acceptedDuration) {
    return <>{renderDuration(acceptedDuration)}</>;
  }
  return null;
}

export function CallScreen({
  activeCall,
  approveUser,
  batchUserAction,
  cancelPresenting,
  changeCallView,
  denyUser,
  getGroupCallVideoFrameSource,
  getPresentingSources,
  groupMembers,
  hangUpActiveCall,
  i18n,
  imageDataCache,
  isCallLinkAdmin,
  me,
  openSystemPreferencesAction,
  renderReactionPicker,
  setGroupCallVideoRequest,
  sendGroupCallRaiseHand,
  sendGroupCallReaction,
  setLocalAudio,
  setLocalVideo,
  setLocalPreviewContainer,
  setRendererCanvas,
  stickyControls,
  switchToPresentationView,
  switchFromPresentationView,
  toggleCallLinkPendingParticipantModal,
  toggleParticipants,
  togglePip,
  toggleScreenRecordingPermissionsDialog,
  toggleSelfViewExpanded,
  toggleSettings,
  setLocalAudioRemoteMuted,
}: PropsType): JSX.Element {
  const {
    conversation,
    hasLocalAudio,
    hasLocalVideo,
    localAudioLevel,
    presentingSource,
    remoteParticipants,
    showNeedsScreenRecordingPermissionsWarning,
    reactions,
  } = activeCall;

  const isSpeaking = useValueAtFixedRate(
    localAudioLevel > 0,
    SPEAKING_LINGER_MS
  );

  useActivateSpeakerViewOnPresenting({
    remoteParticipants,
    switchToPresentationView,
    switchFromPresentationView,
  });

  const activeCallShortcuts = useActiveCallShortcuts(hangUpActiveCall);
  useKeyboardShortcuts(activeCallShortcuts);

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
      cancelPresenting();
    } else {
      getPresentingSources();
    }
  }, [getPresentingSources, presentingSource, cancelPresenting]);

  const hangUp = useCallback(() => {
    hangUpActiveCall('button click');
  }, [hangUpActiveCall]);

  const reactButtonRef = React.useRef<null | HTMLDivElement>(null);
  const reactionPickerRef = React.useRef<null | HTMLDivElement>(null);
  const reactionPickerContainerRef = React.useRef<null | HTMLDivElement>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const toggleReactionPicker = useCallback(() => {
    setShowReactionPicker(prevValue => !prevValue);
  }, []);

  const [showRaisedHandsList, setShowRaisedHandsList] = useState(false);
  const toggleRaisedHandsList = useCallback(() => {
    setShowRaisedHandsList(prevValue => !prevValue);
  }, []);

  const [controlsHover, setControlsHover] = useState(false);
  const onControlsMouseEnter = useCallback(() => {
    setControlsHover(true);
  }, [setControlsHover]);

  const onControlsMouseLeave = useCallback(() => {
    setControlsHover(false);
  }, [setControlsHover]);

  const [showControls, setShowControls] = useState(true);
  useEffect(() => {
    if (
      !showControls ||
      showReactionPicker ||
      stickyControls ||
      controlsHover
    ) {
      return noop;
    }
    const timer = setTimeout(() => {
      setShowControls(false);
    }, 5000);
    return clearTimeout.bind(null, timer);
  }, [showControls, showReactionPicker, stickyControls, controlsHover]);
  useEffect(() => {
    const name = 'CallScreen';
    const callback = async () => {
      togglePip();
      return BeforeNavigateResponse.MadeChanges;
    };
    beforeNavigateService.registerCallback({
      callback,
      name,
    });
    return () => {
      beforeNavigateService.unregisterCallback({
        callback,
        name,
      });
    };
  }, [togglePip]);

  const [selfViewHover, setSelfViewHover] = useState(false);
  const onSelfViewMouseEnter = useCallback(() => {
    setSelfViewHover(true);
  }, [setSelfViewHover]);

  const onSelfViewMouseLeave = useCallback(() => {
    setSelfViewHover(false);
  }, [setSelfViewHover]);

  const [showSelfViewControls, setShowSelfViewControls] = useState(false);
  useEffect(() => {
    if (selfViewHover) {
      setShowSelfViewControls(true);
      return;
    }

    const timer = setTimeout(() => {
      setShowSelfViewControls(false);
    }, 2000);
    return clearTimeout.bind(null, timer);
  }, [showSelfViewControls, setShowSelfViewControls, selfViewHover]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      let eventHandled = false;

      const key = KeyboardLayout.lookup(event);

      if (event.shiftKey && (key === 'V' || key === 'v')) {
        toggleVideo();
        setShowControls(true);
        eventHandled = true;
      } else if (event.shiftKey && (key === 'M' || key === 'm')) {
        toggleAudio();
        setShowControls(true);
        eventHandled = true;
      } else if (event.shiftKey && (key === 'P' || key === 'p')) {
        toggleSelfViewExpanded();
        eventHandled = true;
      }

      if (eventHandled) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [setShowControls, toggleAudio, toggleSelfViewExpanded, toggleVideo]);

  useEffect(() => {
    if (!showReactionPicker) {
      return noop;
    }
    return handleOutsideClick(
      target => {
        if (
          target instanceof Element &&
          target.closest('[data-fun-overlay]') != null
        ) {
          return true;
        }
        setShowReactionPicker(false);
        return true;
      },
      {
        containerElements: [reactButtonRef, reactionPickerContainerRef],
        name: 'CallScreen.reactionPicker',
      }
    );
  }, [showReactionPicker]);

  useScreenSharingStoppedToast({ activeCall, i18n });
  useViewModeChangedToast({ activeCall, i18n });

  const currentPresenter = remoteParticipants.find(
    participant => participant.presenting
  );

  const hasRemoteVideo = remoteParticipants.some(
    remoteParticipant => remoteParticipant.hasRemoteVideo
  );

  const isSendingVideo = hasLocalVideo || presentingSource;
  const isReconnecting: boolean = callingIsReconnecting(activeCall);

  let isRinging: boolean;
  let hasCallStarted: boolean;
  let isConnecting: boolean;
  let isConnected: boolean;
  let participantCount: number;
  let conversationsByDemuxId: ConversationsByDemuxIdType;
  let localDemuxId: number | undefined;

  switch (activeCall.callMode) {
    case CallMode.Direct: {
      isConnecting = activeCall.callState === CallState.Prering;
      isRinging = activeCall.callState === CallState.Ringing;
      hasCallStarted =
        activeCall.callState !== CallState.Prering &&
        activeCall.callState !== CallState.Ringing;
      isConnected = activeCall.callState === CallState.Accepted;
      participantCount = isConnected ? 2 : 0;
      conversationsByDemuxId = new Map();
      break;
    }
    case CallMode.Group:
    case CallMode.Adhoc:
      isRinging =
        activeCall.outgoingRing &&
        !activeCall.remoteParticipants.length &&
        !(groupMembers?.length === 1 && groupMembers[0].id === me.id);
      hasCallStarted = activeCall.joinState !== GroupCallJoinState.NotJoined;
      participantCount = activeCall.remoteParticipants.length + 1;
      conversationsByDemuxId = activeCall.conversationsByDemuxId;
      localDemuxId = activeCall.localDemuxId;

      isConnected =
        activeCall.connectionState === GroupCallConnectionState.Connected;
      isConnecting =
        activeCall.connectionState === GroupCallConnectionState.Connecting;
      break;
    default:
      throw missingCaseError(activeCall);
  }

  const pendingParticipants =
    activeCall.callMode === CallMode.Adhoc && isCallLinkAdmin
      ? activeCall.pendingParticipants
      : [];

  let lonelyInCallNode: ReactNode;
  let localPreviewNode: ReactNode;

  const raisedHands = isGroupOrAdhocActiveCall(activeCall)
    ? activeCall.raisedHands
    : undefined;

  // This is the value of our hand raised as seen by remote clients. We should prefer
  // to use it in UI so the user understands what remote clients see.
  const syncedLocalHandRaised = isHandRaised(raisedHands, localDemuxId);

  const isLonelyInCall = !activeCall.remoteParticipants.length;
  const isAudioOnly = !hasLocalVideo && !hasRemoteVideo;

  const controlsFadedOut = !showControls && !isAudioOnly && isConnected;
  const controlsFadeClass = classNames({
    'module-ongoing-call__controls': true,
    'module-ongoing-call__controls--fadeIn':
      (showControls || isAudioOnly) && !isConnected,
    'module-ongoing-call__controls--fadeOut': controlsFadedOut,
  });

  const handlePreviewClick = useCallback(
    (event?: React.MouseEvent) => {
      event?.preventDefault();
      event?.stopPropagation();

      toggleSelfViewExpanded();
    },
    [toggleSelfViewExpanded]
  );

  if (isLonelyInCall) {
    lonelyInCallNode = (
      <div
        className={classNames(
          'module-ongoing-call__local-preview-fullsize',
          presentingSource &&
            'module-ongoing-call__local-preview-fullsize--presenting'
        )}
      >
        {isSendingVideo ? (
          <div
            className="module-ongoing-call__local-preview-container"
            ref={setLocalPreviewContainer}
          />
        ) : (
          <CallBackgroundBlur avatarUrl={me.avatarUrl}>
            <div className="module-calling__spacer module-calling__camera-is-off-spacer" />
            <div className="module-calling__camera-is-off">
              {i18n('icu:calling__your-video-is-off')}
            </div>
          </CallBackgroundBlur>
        )}
      </div>
    );
  } else {
    const innerPreviewNode = isSendingVideo ? (
      <div
        className={classNames(
          'module-ongoing-call__local-preview__video',
          presentingSource &&
            'module-ongoing-call__local-preview__video--presenting'
        )}
        ref={setLocalPreviewContainer}
      />
    ) : (
      <CallBackgroundBlur
        className="module-ongoing-call__local-preview__background"
        avatarUrl={me.avatarUrl}
      >
        <Avatar
          avatarPlaceholderGradient={me.avatarPlaceholderGradient}
          avatarUrl={me.avatarUrl}
          badge={undefined}
          color={me.color || AvatarColors[0]}
          hasAvatar={me.hasAvatar}
          noteToSelf={false}
          conversationType="direct"
          i18n={i18n}
          phoneNumber={me.phoneNumber}
          profileName={me.profileName}
          title={me.title}
          // See comment above about `sharedGroupNames`.
          sharedGroupNames={[]}
          size={AvatarSize.FORTY}
        />
      </CallBackgroundBlur>
    );
    localPreviewNode = (
      // Keyboard shortcuts are available for this gesture, no need for keyboard support
      /* eslint-disable-next-line max-len */
      /* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */
      <div
        className={classNames(
          'module-ongoing-call__local-preview',
          'module-ongoing-call__local-preview--active',
          activeCall.selfViewExpanded
            ? 'module-ongoing-call__local-preview--expanded'
            : undefined,
          controlsFadedOut
            ? 'module-ongoing-call__local-preview--controls-hidden'
            : undefined
        )}
        onMouseEnter={onSelfViewMouseEnter}
        onMouseLeave={onSelfViewMouseLeave}
        onClick={handlePreviewClick}
      >
        {innerPreviewNode}
        {!isSendingVideo && (
          <div
            className={classNames(
              'CallingStatusIndicator',
              'CallingStatusIndicator--NoVideo',
              !showSelfViewControls
                ? 'module-ongoing-call__controls--fadeIn'
                : undefined,
              showSelfViewControls
                ? 'module-ongoing-call__controls--fadeOut'
                : undefined
            )}
          />
        )}
        <CallingAudioIndicator
          hasAudio={hasLocalAudio}
          audioLevel={localAudioLevel}
          shouldShowSpeaking={isSpeaking}
        />
        <div
          className={classNames(
            'CallingButton__Button--self-view',
            showSelfViewControls
              ? 'module-ongoing-call__controls--fadeIn'
              : undefined,
            !showSelfViewControls
              ? 'module-ongoing-call__controls--fadeOut'
              : undefined,
            !activeCall.selfViewExpanded
              ? 'CallingButton__Button--self-view-normal'
              : undefined
          )}
        >
          <CallingButton
            buttonType={
              activeCall.selfViewExpanded
                ? CallingButtonType.MINIMIZE
                : CallingButtonType.MAXIMIZE
            }
            i18n={i18n}
            onClick={handlePreviewClick}
          />
        </div>
        {syncedLocalHandRaised && (
          <div className="CallingStatusIndicator CallingStatusIndicator--HandRaised" />
        )}
      </div>
    );
  }

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

  const isGroupCall = isGroupOrAdhocActiveCall(activeCall);

  let presentingButtonType: CallingButtonType;
  if (presentingSource) {
    presentingButtonType = CallingButtonType.PRESENTING_ON;
  } else if (currentPresenter) {
    presentingButtonType = CallingButtonType.PRESENTING_DISABLED;
  } else {
    presentingButtonType = CallingButtonType.PRESENTING_OFF;
  }

  // Don't call setLocalHandRaised because it only sets local state. Instead call
  // toggleRaiseHand() which will set ringrtc state and call setLocalHandRaised.
  const [localHandRaised, setLocalHandRaised] = useState<boolean>(
    syncedLocalHandRaised
  );
  const previousLocalHandRaised = usePrevious(localHandRaised, localHandRaised);
  const toggleRaiseHand = useCallback(
    (raise?: boolean) => {
      const nextValue = raise ?? !localHandRaised;
      if (nextValue === previousLocalHandRaised) {
        return;
      }

      setLocalHandRaised(nextValue);
      // It's possible that the ringrtc call can fail due to flaky network connection.
      // In that case, local and remote state (localHandRaised and raisedHands) can
      // get out of sync. The user might need to manually toggle raise hand to get to
      // a coherent state. It would be nice if this returned a Promise (but it doesn't)
      sendGroupCallRaiseHand({
        conversationId: conversation.id,
        raise: nextValue,
      });
    },
    [
      localHandRaised,
      previousLocalHandRaised,
      conversation.id,
      sendGroupCallRaiseHand,
    ]
  );

  let raiseHandButtonType: CallingButtonType | undefined;
  let reactButtonType: CallingButtonType | undefined;
  if (isGroupCall) {
    raiseHandButtonType = localHandRaised
      ? CallingButtonType.RAISE_HAND_ON
      : CallingButtonType.RAISE_HAND_OFF;
    reactButtonType = showReactionPicker
      ? CallingButtonType.REACT_ON
      : CallingButtonType.REACT_OFF;
  }

  const renderRaisedHandsToast = React.useCallback(
    (demuxIds: Array<number>) => {
      const names: Array<string> = [];
      let isYourHandRaised = false;
      for (const demuxId of demuxIds) {
        if (demuxId === localDemuxId) {
          isYourHandRaised = true;
          continue;
        }

        const handConversation = conversationsByDemuxId.get(demuxId);
        if (!handConversation) {
          continue;
        }

        names.push(handConversation.title);
      }

      const count = names.length;
      const name = names[0] ?? '';
      const otherName = names[1] ?? '';

      let message: string;
      let buttonOverride: JSX.Element | undefined;
      switch (count) {
        case 0:
          return undefined;
        case 1:
          if (isYourHandRaised) {
            message = i18n('icu:CallControls__RaiseHandsToast--you');
            buttonOverride = (
              <button
                className="CallingRaisedHandsToasts__Link"
                onClick={() => toggleRaiseHand(false)}
                type="button"
              >
                {i18n('icu:CallControls__RaiseHands--lower')}
              </button>
            );
          } else {
            message = i18n('icu:CallControls__RaiseHandsToast--one', {
              name,
            });
          }
          break;
        case 2:
          if (isYourHandRaised) {
            message = i18n('icu:CallControls__RaiseHandsToast--you-and-one', {
              otherName,
            });
          } else {
            message = i18n('icu:CallControls__RaiseHandsToast--two', {
              name,
              otherName,
            });
          }
          break;
        default: {
          const overflowCount = count - 2;
          if (isYourHandRaised) {
            message = i18n('icu:CallControls__RaiseHandsToast--you-and-more', {
              otherName,
              overflowCount,
            });
          } else {
            message = i18n('icu:CallControls__RaiseHandsToast--more', {
              name: names[0] ?? '',
              otherName,
              overflowCount,
            });
          }
        }
      }
      return (
        <div className="CallingRaisedHandsToast__Content">
          <span className="CallingRaisedHandsToast__HandIcon" />
          {message}
          {buttonOverride || (
            <button
              className="link CallingRaisedHandsToasts__Link"
              onClick={() => setShowRaisedHandsList(true)}
              type="button"
            >
              {i18n('icu:CallControls__RaiseHands--open-queue')}
            </button>
          )}
        </div>
      );
    },
    [i18n, localDemuxId, conversationsByDemuxId, toggleRaiseHand]
  );

  const raisedHandsCount: number = raisedHands?.size ?? 0;

  const callStatus: ReactNode | string = React.useMemo(() => {
    if (isConnecting) {
      return i18n('icu:outgoingCallConnecting');
    }
    if (isRinging) {
      return i18n('icu:outgoingCallRinging');
    }
    if (isReconnecting) {
      return i18n('icu:callReconnecting');
    }
    if (isGroupCall) {
      return (
        <CallParticipantCount
          callMode={activeCall.callMode}
          i18n={i18n}
          participantCount={participantCount}
          toggleParticipants={toggleParticipants}
        />
      );
    }
    if (isConnected && activeCall.callMode === CallMode.Direct) {
      return <CallDuration joinedAt={activeCall.joinedAt} />;
    }
    if (hasLocalVideo) {
      return i18n('icu:ContactListItem__menu__video-call');
    }
    if (hasLocalAudio) {
      return i18n('icu:CallControls__InfoDisplay--audio-call');
    }
    return null;
  }, [
    i18n,
    isConnecting,
    isRinging,
    isConnected,
    activeCall.callMode,
    activeCall.joinedAt,
    isReconnecting,
    isGroupCall,
    participantCount,
    hasLocalVideo,
    hasLocalAudio,
    toggleParticipants,
  ]);

  let remoteParticipantsElement: ReactNode;
  switch (activeCall.callMode) {
    case CallMode.Direct: {
      assertDev(
        conversation.type === 'direct',
        'direct call must have direct conversation'
      );
      remoteParticipantsElement = hasCallStarted ? (
        <DirectCallRemoteParticipant
          conversation={conversation}
          hasRemoteVideo={hasRemoteVideo}
          i18n={i18n}
          isReconnecting={isReconnecting}
          setRendererCanvas={setRendererCanvas}
        />
      ) : (
        <div className="module-ongoing-call__direct-call-ringing-spacer" />
      );
      break;
    }
    case CallMode.Group:
    case CallMode.Adhoc:
      remoteParticipantsElement = (
        <GroupCallRemoteParticipants
          callViewMode={activeCall.viewMode}
          getGroupCallVideoFrameSource={getGroupCallVideoFrameSource}
          imageDataCache={imageDataCache}
          i18n={i18n}
          joinedAt={activeCall.joinedAt}
          remoteParticipants={activeCall.remoteParticipants}
          setGroupCallVideoRequest={setGroupCallVideoRequest}
          remoteAudioLevels={activeCall.remoteAudioLevels}
          isCallReconnecting={isReconnecting}
          onClickRaisedHand={
            raisedHandsCount > 0
              ? () => setShowRaisedHandsList(true)
              : undefined
          }
        />
      );
      break;
    default:
      throw missingCaseError(activeCall);
  }

  return (
    <div
      className={classNames(
        'module-calling__container',
        `module-ongoing-call__container--${getCallModeClassSuffix(
          activeCall.callMode
        )}`,
        `module-ongoing-call__container--${
          hasCallStarted ? 'call-started' : 'call-not-started'
        }`,
        { 'module-ongoing-call__container--hide-controls': !showControls },
        {
          'module-ongoing-call__container--controls-faded-out':
            controlsFadedOut,
        },
        'dark-theme'
      )}
      onFocus={() => {
        setShowControls(true);
      }}
      onMouseMove={() => {
        setShowControls(true);
      }}
      role="group"
    >
      {isReconnecting ? (
        <PersistentCallingToast>
          <span className="CallingToast__reconnecting">
            <Spinner svgSize="small" size="16px" />
            {i18n('icu:callReconnecting')}
          </span>
        </PersistentCallingToast>
      ) : null}

      {isLonelyInCall && !isRinging ? (
        <PersistentCallingToast>
          {i18n('icu:calling__in-this-call--zero')}
        </PersistentCallingToast>
      ) : null}

      {currentPresenter ? (
        <PersistentCallingToast>
          {i18n('icu:calling__presenting--person-ongoing', {
            name: currentPresenter.title,
          })}
        </PersistentCallingToast>
      ) : null}

      {showNeedsScreenRecordingPermissionsWarning ? (
        <NeedsScreenRecordingPermissionsModal
          toggleScreenRecordingPermissionsDialog={
            toggleScreenRecordingPermissionsDialog
          }
          i18n={i18n}
          openSystemPreferencesAction={openSystemPreferencesAction}
        />
      ) : null}
      <div className={controlsFadeClass}>
        <CallingHeader
          callViewMode={activeCall.viewMode}
          changeCallView={changeCallView}
          i18n={i18n}
          isGroupCall={isGroupCall}
          participantCount={participantCount}
          togglePip={togglePip}
          toggleSettings={toggleSettings}
        />
      </div>
      {(isConnecting || isRinging) && (
        <>
          <div className="module-CallingPreCallInfo-spacer" />
          <CallingPreCallInfo
            conversation={conversation}
            groupMembers={groupMembers}
            i18n={i18n}
            isConnecting={isConnecting}
            me={me}
            ringMode={RingMode.IsRinging}
          />
        </>
      )}
      {remoteParticipantsElement}
      {lonelyInCallNode}
      {raisedHands && (
        <>
          <CallingRaisedHandsListButton
            i18n={i18n}
            syncedLocalHandRaised={syncedLocalHandRaised}
            raisedHandsCount={raisedHandsCount}
            onClick={toggleRaisedHandsList}
          />
          {showRaisedHandsList && raisedHandsCount > 0 && (
            <CallingRaisedHandsList
              i18n={i18n}
              onClose={() => setShowRaisedHandsList(false)}
              onLowerMyHand={() => {
                toggleRaiseHand(false);
                setShowRaisedHandsList(false);
              }}
              localDemuxId={localDemuxId}
              conversationsByDemuxId={conversationsByDemuxId}
              raisedHands={raisedHands}
              localHandRaised={syncedLocalHandRaised}
            />
          )}
        </>
      )}
      <CallingReactionsToastsContainer
        reactions={reactions}
        conversationsByDemuxId={conversationsByDemuxId}
        localDemuxId={localDemuxId}
        i18n={i18n}
      />
      <CallingButtonToastsContainer
        hasLocalAudio={hasLocalAudio}
        outgoingRing={undefined}
        raisedHands={raisedHands}
        renderRaisedHandsToast={renderRaisedHandsToast}
        handleLowerHand={() => toggleRaiseHand(false)}
        suggestLowerHand={
          isGroupOrAdhocActiveCall(activeCall)
            ? activeCall.suggestLowerHand
            : false
        }
        isHandRaised={localHandRaised}
        mutedBy={
          isGroupOrAdhocActiveCall(activeCall) ? activeCall.mutedBy : undefined
        }
        observedRemoteMute={
          isGroupOrAdhocActiveCall(activeCall)
            ? activeCall.observedRemoteMute
            : undefined
        }
        conversationsByDemuxId={conversationsByDemuxId}
        i18n={i18n}
        setLocalAudioRemoteMuted={setLocalAudioRemoteMuted}
      />
      {isCallLinkAdmin ? (
        <CallingPendingParticipants
          i18n={i18n}
          participants={pendingParticipants}
          approveUser={approveUser}
          batchUserAction={batchUserAction}
          denyUser={denyUser}
          toggleCallLinkPendingParticipantModal={
            toggleCallLinkPendingParticipantModal
          }
        />
      ) : null}
      {activeCall.callMode === CallMode.Direct && (
        <div
          className={classNames(
            'module-ongoing-call__direct-call-speaking-indicator',
            activeCall.selfViewExpanded
              ? 'module-ongoing-call__direct-call-speaking-indicator--self-view-expanded'
              : undefined,
            activeCall.selfViewExpanded && controlsFadedOut
              ? 'module-ongoing-call__direct-call-speaking-indicator--expanded-no-controls'
              : undefined
          )}
        >
          <CallingAudioIndicator
            hasAudio={activeCall.hasRemoteAudio}
            audioLevel={activeCall.remoteAudioLevel}
            shouldShowSpeaking={activeCall.remoteAudioLevel > 0}
          />
        </div>
      )}
      {localPreviewNode}
      {/* We set flex direction to row-reverse to render outward from local preview */}
      <div className="module-ongoing-call__footer">
        <div className="module-calling__spacer CallControls__OuterSpacer" />
        <div
          className={classNames(
            'CallControls',
            'module-ongoing-call__footer__actions',
            controlsFadeClass
          )}
        >
          <div className="CallControls__InfoDisplay">
            <div className="CallControls__CallTitle">{conversation.title}</div>
            <div className="CallControls__Status">{callStatus}</div>
          </div>

          {showReactionPicker && (
            <div
              className="CallControls__ReactionPickerContainer"
              ref={reactionPickerContainerRef}
            >
              {renderReactionPicker({
                ref: reactionPickerRef,
                onClose: () => setShowReactionPicker(false),
                onPick: emoji => {
                  setShowReactionPicker(false);
                  sendGroupCallReaction({
                    callMode: activeCall.callMode,
                    conversationId: conversation.id,
                    value: emoji,
                  });
                },
              })}
            </div>
          )}

          <div className="CallControls__ButtonContainer">
            <CallingButton
              buttonType={videoButtonType}
              i18n={i18n}
              onMouseEnter={onControlsMouseEnter}
              onMouseLeave={onControlsMouseLeave}
              onClick={toggleVideo}
              tooltipDirection={TooltipPlacement.Top}
            />
            <CallingButton
              buttonType={audioButtonType}
              i18n={i18n}
              onMouseEnter={onControlsMouseEnter}
              onMouseLeave={onControlsMouseLeave}
              onClick={toggleAudio}
              tooltipDirection={TooltipPlacement.Top}
            />
            {raiseHandButtonType && (
              <CallingButton
                buttonType={raiseHandButtonType}
                i18n={i18n}
                onMouseEnter={onControlsMouseEnter}
                onMouseLeave={onControlsMouseLeave}
                onClick={() => toggleRaiseHand()}
                tooltipDirection={TooltipPlacement.Top}
              />
            )}
            <CallingButton
              buttonType={presentingButtonType}
              i18n={i18n}
              onMouseEnter={onControlsMouseEnter}
              onMouseLeave={onControlsMouseLeave}
              onClick={togglePresenting}
              tooltipDirection={TooltipPlacement.Top}
            />
            {reactButtonType && (
              <div
                className={classNames('CallControls__ReactButtonContainer', {
                  'CallControls__ReactButtonContainer--menu-shown':
                    showReactionPicker,
                })}
                ref={reactButtonRef}
              >
                <CallingButton
                  buttonType={reactButtonType}
                  i18n={i18n}
                  onMouseEnter={onControlsMouseEnter}
                  onMouseLeave={onControlsMouseLeave}
                  onClick={toggleReactionPicker}
                  tooltipDirection={TooltipPlacement.Top}
                />
              </div>
            )}
          </div>
          <div
            className="CallControls__JoinLeaveButtonContainer"
            onMouseEnter={onControlsMouseEnter}
            onMouseLeave={onControlsMouseLeave}
          >
            <Button
              className="CallControls__JoinLeaveButton CallControls__JoinLeaveButton--hangup"
              onClick={hangUp}
              variant={ButtonVariant.Destructive}
            >
              {isGroupCall
                ? i18n('icu:CallControls__JoinLeaveButton--hangup-group')
                : i18n('icu:CallControls__JoinLeaveButton--hangup-1-1')}
            </Button>
          </div>
        </div>
        <div className="module-calling__spacer CallControls__OuterSpacer" />
      </div>
    </div>
  );
}

function getCallModeClassSuffix(
  callMode: CallMode.Direct | CallMode.Group | CallMode.Adhoc
): string {
  switch (callMode) {
    case CallMode.Direct:
      return 'direct';
    case CallMode.Group:
    case CallMode.Adhoc:
      return 'group';
    default:
      throw missingCaseError(callMode);
  }
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

function useViewModeChangedToast({
  activeCall,
  i18n,
}: {
  activeCall: ActiveCallType;
  i18n: LocalizerType;
}): void {
  const { viewMode } = activeCall;
  const previousViewMode = usePrevious(viewMode, viewMode);
  const presenterAci = usePresenter(activeCall.remoteParticipants);

  const VIEW_MODE_CHANGED_TOAST_KEY = 'view-mode-changed';
  const { showToast, hideToast } = useCallingToasts();

  useEffect(() => {
    if (viewMode !== previousViewMode) {
      if (
        // If this is an automated change to presentation mode, don't show toast
        viewMode === CallViewMode.Presentation ||
        // if this is an automated change away from presentation mode, don't show toast
        (previousViewMode === CallViewMode.Presentation && !presenterAci)
      ) {
        return;
      }

      hideToast(VIEW_MODE_CHANGED_TOAST_KEY);
      showToast({
        key: VIEW_MODE_CHANGED_TOAST_KEY,
        content: (
          <div className="CallingToast__viewChanged">
            <span
              className={classNames(
                'CallingToast__viewChanged__icon',
                getCallViewIconClassname(viewMode)
              )}
            />
            {i18n('icu:calling__view_mode--updated')}
          </div>
        ),
        autoClose: true,
      });
    }
  }, [
    showToast,
    hideToast,
    i18n,
    activeCall,
    viewMode,
    previousViewMode,
    presenterAci,
  ]);
}

type CallingReactionsToastsType = {
  reactions: ActiveCallReactionsType | undefined;
  conversationsByDemuxId: Map<number, ConversationType>;
  localDemuxId: number | undefined;
  i18n: LocalizerType;
};

type UseReactionsToastType = CallingReactionsToastsType & {
  showBurst: (toast: CallReactionBurstType) => string;
};

function useReactionsToast(props: UseReactionsToastType): void {
  const { reactions, conversationsByDemuxId, localDemuxId, i18n, showBurst } =
    props;
  const ourServiceId: ServiceIdString | undefined = localDemuxId
    ? conversationsByDemuxId.get(localDemuxId)?.serviceId
    : undefined;

  const [previousReactions, setPreviousReactions] = React.useState<
    ActiveCallReactionsType | undefined
  >(undefined);
  const reactionsShown = useRef<
    Map<
      string,
      {
        value: string;
        originalValue: string;
        isBursted: boolean;
        expireAt: number;
        demuxId: number;
      }
    >
  >(new Map());
  const burstsShown = useRef<Map<string, number>>(new Map());
  const { showToast } = useCallingToasts();
  const emojiLocalizer = useFunEmojiLocalizer();

  useEffect(() => {
    setPreviousReactions(reactions);
  }, [reactions]);

  useEffect(() => {
    if (!reactions || isEqual(reactions, previousReactions)) {
      return;
    }

    const time = Date.now();
    let anyReactionWasShown = false;
    reactions.forEach(({ timestamp, demuxId, value }) => {
      const conversation = conversationsByDemuxId.get(demuxId);
      if (!conversation) {
        return;
      }

      const key = `reactions-${timestamp}-${demuxId}`;

      strictAssert(isEmojiVariantValue(value), 'Expected a valid emoji value');
      const emojiVariantKey = getEmojiVariantKeyByValue(value);
      const emojiVariant = getEmojiVariantByKey(emojiVariantKey);

      showToast({
        key,
        onlyShowOnce: true,
        autoClose: true,
        content: (
          <span className="CallingReactionsToasts__reaction">
            <FunStaticEmoji
              role="img"
              aria-label={emojiLocalizer.getLocaleShortName(emojiVariantKey)}
              size={28}
              emoji={emojiVariant}
            />
            {demuxId === localDemuxId ||
            (ourServiceId && conversation?.serviceId === ourServiceId)
              ? i18n('icu:CallingReactions--me')
              : conversation?.title}
          </span>
        ),
      });

      // Track shown reactions for burst purposes. Skip if it's already tracked.
      if (reactionsShown.current.has(key)) {
        return;
      }

      // If there's a recent burst for this emoji, treat it as part of that burst.
      const recentBurstTime = burstsShown.current.get(value);
      const isBursted = !!(
        recentBurstTime &&
        recentBurstTime + REACTIONS_BURST_TRAILING_WINDOW > time
      );
      // Normalize skin tone emoji to calculate burst threshold, but save original
      // value to show in the burst animation
      const emojiParentKey = getEmojiParentKeyByVariantKey(emojiVariantKey);
      const emojiParent = getEmojiParentByKey(emojiParentKey);
      const normalizedValue = emojiParent.value;
      reactionsShown.current.set(key, {
        value: normalizedValue,
        originalValue: value,
        isBursted,
        expireAt: timestamp + REACTIONS_BURST_WINDOW,
        demuxId,
      });
      anyReactionWasShown = true;
    });

    if (!anyReactionWasShown) {
      return;
    }

    const unburstedEmojis = new Map<string, Set<string>>();
    const unburstedEmojisReactorIds = new Map<
      string,
      Set<ServiceIdString | number>
    >();
    reactionsShown.current.forEach(
      ({ value, isBursted, expireAt, demuxId }, key) => {
        if (expireAt < time) {
          reactionsShown.current.delete(key);
          return;
        }

        if (isBursted) {
          return;
        }

        const reactionKeys = unburstedEmojis.get(value) ?? new Set();
        reactionKeys.add(key);
        unburstedEmojis.set(value, reactionKeys);

        // Only burst when enough unique people react.
        const conversation = conversationsByDemuxId.get(demuxId);
        const reactorId = conversation?.serviceId || demuxId;
        const reactorIdSet = unburstedEmojisReactorIds.get(value) ?? new Set();
        reactorIdSet.add(reactorId);
        unburstedEmojisReactorIds.set(value, reactorIdSet);
      }
    );

    burstsShown.current.forEach((timestamp, value) => {
      if (timestamp < time - REACTIONS_BURST_SHORT_WINDOW) {
        burstsShown.current.delete(value);
      }
    });

    if (burstsShown.current.size >= REACTIONS_BURST_MAX_IN_SHORT_WINDOW) {
      return;
    }

    for (const [value, reactorIds] of unburstedEmojisReactorIds.entries()) {
      if (reactorIds.size < REACTIONS_BURST_THRESHOLD) {
        continue;
      }

      const reactionKeys = unburstedEmojis.get(value);
      if (!reactionKeys) {
        unburstedEmojisReactorIds.delete(value);
        continue;
      }

      burstsShown.current.set(value, time);
      const values: Array<string> = [];
      reactionKeys.forEach(key => {
        const reactionShown = reactionsShown.current.get(key);
        if (!reactionShown) {
          return;
        }

        reactionShown.isBursted = true;
        values.push(reactionShown.originalValue);
      });
      showBurst({ values });

      if (burstsShown.current.size >= REACTIONS_BURST_MAX_IN_SHORT_WINDOW) {
        break;
      }
    }
  }, [
    reactions,
    previousReactions,
    showBurst,
    showToast,
    conversationsByDemuxId,
    localDemuxId,
    i18n,
    ourServiceId,
    emojiLocalizer,
  ]);
}

function CallingReactionsToastsContainer(
  props: CallingReactionsToastsType
): JSX.Element {
  const { i18n } = props;
  const toastRegionRef = useRef<HTMLDivElement>(null);
  const burstRegionRef = useRef<HTMLDivElement>(null);

  return (
    <CallingToastProvider
      i18n={i18n}
      maxNonPersistentToasts={5}
      region={toastRegionRef}
      lifetime={CALLING_REACTIONS_LIFETIME}
      transitionFrom={REACTIONS_TOASTS_TRANSITION_FROM}
    >
      <CallReactionBurstProvider region={burstRegionRef}>
        <div className="CallingReactionsToasts" ref={toastRegionRef} />
        <div className="CallingReactionsBurstToasts" ref={burstRegionRef} />
        <CallingReactionsToasts {...props} />
      </CallReactionBurstProvider>
    </CallingToastProvider>
  );
}

function CallingReactionsToasts(props: CallingReactionsToastsType) {
  const { showBurst } = useCallReactionBursts();
  useReactionsToast({ ...props, showBurst });
  return null;
}

function isHandRaised(
  raisedHands: Set<number> | undefined,
  demuxId: number | undefined
): boolean {
  if (raisedHands === undefined || demuxId === undefined) {
    return false;
  }

  return raisedHands.has(demuxId);
}
