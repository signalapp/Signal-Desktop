// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useEffect } from 'react';
import { noop } from 'lodash';
import type { VideoFrameSource } from '@signalapp/ringrtc';
import { CallNeedPermissionScreen } from './CallNeedPermissionScreen';
import { CallScreen } from './CallScreen';
import { CallingLobby } from './CallingLobby';
import { CallingParticipantsList } from './CallingParticipantsList';
import { CallingSelectPresentingSourcesModal } from './CallingSelectPresentingSourcesModal';
import { CallingPip } from './CallingPip';
import { IncomingCallBar } from './IncomingCallBar';
import type { SafetyNumberProps } from './SafetyNumberChangeDialog';
import { SafetyNumberChangeDialog } from './SafetyNumberChangeDialog';
import type {
  ActiveCallType,
  CallViewMode,
  GroupCallVideoRequest,
  PresentedSource,
} from '../types/Calling';
import {
  CallEndedReason,
  CallMode,
  CallState,
  GroupCallConnectionState,
  GroupCallJoinState,
} from '../types/Calling';
import type { ConversationType } from '../state/ducks/conversations';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import type {
  AcceptCallType,
  CancelCallType,
  DeclineCallType,
  KeyChangeOkType,
  SendGroupCallRaiseHandType,
  SendGroupCallReactionType,
  SetGroupCallVideoRequestType,
  SetLocalAudioType,
  SetLocalPreviewType,
  SetLocalVideoType,
  SetRendererCanvasType,
  StartCallType,
} from '../state/ducks/calling';
import type { LocalizerType, ThemeType } from '../types/Util';
import { missingCaseError } from '../util/missingCaseError';
import { CallingToastProvider } from './CallingToast';
import type { SmartReactionPicker } from '../state/smart/ReactionPicker';
import type { Props as ReactionPickerProps } from './conversation/ReactionPicker';

const GROUP_CALL_RING_DURATION = 60 * 1000;

export type PropsType = {
  activeCall?: ActiveCallType;
  availableCameras: Array<MediaDeviceInfo>;
  cancelCall: (_: CancelCallType) => void;
  changeCallView: (mode: CallViewMode) => void;
  closeNeedPermissionScreen: () => void;
  getGroupCallVideoFrameSource: (
    conversationId: string,
    demuxId: number
  ) => VideoFrameSource;
  getPreferredBadge: PreferredBadgeSelectorType;
  getPresentingSources: () => void;
  incomingCall?:
    | {
        callMode: CallMode.Direct;
        conversation: ConversationType;
        isVideoCall: boolean;
      }
    | {
        callMode: CallMode.Group;
        conversation: ConversationType;
        otherMembersRung: Array<Pick<ConversationType, 'firstName' | 'title'>>;
        ringer: Pick<ConversationType, 'firstName' | 'title'>;
      };
  keyChangeOk: (_: KeyChangeOkType) => void;
  renderDeviceSelection: () => JSX.Element;
  renderReactionPicker: (
    props: React.ComponentProps<typeof SmartReactionPicker>
  ) => JSX.Element;
  renderSafetyNumberViewer: (props: SafetyNumberProps) => JSX.Element;
  startCall: (payload: StartCallType) => void;
  toggleParticipants: () => void;
  acceptCall: (_: AcceptCallType) => void;
  bounceAppIconStart: () => unknown;
  bounceAppIconStop: () => unknown;
  declineCall: (_: DeclineCallType) => void;
  i18n: LocalizerType;
  isGroupCallOutboundRingEnabled: boolean;
  isGroupCallRaiseHandEnabled: boolean;
  isGroupCallReactionsEnabled: boolean;
  me: ConversationType;
  notifyForCall: (
    conversationId: string,
    title: string,
    isVideoCall: boolean
  ) => unknown;
  openSystemPreferencesAction: () => unknown;
  playRingtone: () => unknown;
  sendGroupCallRaiseHand: (payload: SendGroupCallRaiseHandType) => void;
  sendGroupCallReaction: (payload: SendGroupCallReactionType) => void;
  setGroupCallVideoRequest: (_: SetGroupCallVideoRequestType) => void;
  setIsCallActive: (_: boolean) => void;
  setLocalAudio: (_: SetLocalAudioType) => void;
  setLocalVideo: (_: SetLocalVideoType) => void;
  setLocalPreview: (_: SetLocalPreviewType) => void;
  setOutgoingRing: (_: boolean) => void;
  setPresenting: (_?: PresentedSource) => void;
  setRendererCanvas: (_: SetRendererCanvasType) => void;
  stopRingtone: () => unknown;
  switchToPresentationView: () => void;
  switchFromPresentationView: () => void;
  hangUpActiveCall: (reason: string) => void;
  theme: ThemeType;
  togglePip: () => void;
  toggleScreenRecordingPermissionsDialog: () => unknown;
  toggleSettings: () => void;
  isConversationTooBigToRing: boolean;
  pauseVoiceNotePlayer: () => void;
} & Pick<ReactionPickerProps, 'renderEmojiPicker'>;

type ActiveCallManagerPropsType = PropsType & {
  activeCall: ActiveCallType;
};

function ActiveCallManager({
  activeCall,
  availableCameras,
  cancelCall,
  changeCallView,
  closeNeedPermissionScreen,
  hangUpActiveCall,
  i18n,
  isGroupCallOutboundRingEnabled,
  isGroupCallRaiseHandEnabled,
  isGroupCallReactionsEnabled,
  keyChangeOk,
  getGroupCallVideoFrameSource,
  getPreferredBadge,
  getPresentingSources,
  me,
  openSystemPreferencesAction,
  renderDeviceSelection,
  renderEmojiPicker,
  renderReactionPicker,
  renderSafetyNumberViewer,
  sendGroupCallRaiseHand,
  sendGroupCallReaction,
  setGroupCallVideoRequest,
  setLocalAudio,
  setLocalPreview,
  setLocalVideo,
  setPresenting,
  setRendererCanvas,
  setOutgoingRing,
  startCall,
  switchToPresentationView,
  switchFromPresentationView,
  theme,
  toggleParticipants,
  togglePip,
  toggleScreenRecordingPermissionsDialog,
  toggleSettings,
  pauseVoiceNotePlayer,
}: ActiveCallManagerPropsType): JSX.Element {
  const {
    conversation,
    hasLocalAudio,
    hasLocalVideo,
    peekedParticipants,
    pip,
    presentingSourcesAvailable,
    settingsDialogOpen,
    showParticipantsList,
    outgoingRing,
  } = activeCall;

  const cancelActiveCall = useCallback(() => {
    cancelCall({ conversationId: conversation.id });
  }, [cancelCall, conversation.id]);

  const joinActiveCall = useCallback(() => {
    // pause any voice note playback
    pauseVoiceNotePlayer();

    startCall({
      callMode: activeCall.callMode,
      conversationId: conversation.id,
      hasLocalAudio,
      hasLocalVideo,
    });
  }, [
    startCall,
    activeCall.callMode,
    conversation.id,
    hasLocalAudio,
    hasLocalVideo,
    pauseVoiceNotePlayer,
  ]);

  const getGroupCallVideoFrameSourceForActiveCall = useCallback(
    (demuxId: number) => {
      return getGroupCallVideoFrameSource(conversation.id, demuxId);
    },
    [getGroupCallVideoFrameSource, conversation.id]
  );

  const setGroupCallVideoRequestForConversation = useCallback(
    (resolutions: Array<GroupCallVideoRequest>, speakerHeight: number) => {
      setGroupCallVideoRequest({
        conversationId: conversation.id,
        resolutions,
        speakerHeight,
      });
    },
    [setGroupCallVideoRequest, conversation.id]
  );

  const onSafetyNumberDialogCancel = useCallback(() => {
    hangUpActiveCall('safety number dialog cancel');
  }, [hangUpActiveCall]);

  let isCallFull: boolean;
  let showCallLobby: boolean;
  let groupMembers:
    | undefined
    | Array<Pick<ConversationType, 'id' | 'firstName' | 'title'>>;
  let isConvoTooBigToRing = false;

  switch (activeCall.callMode) {
    case CallMode.Direct: {
      const { callState, callEndedReason } = activeCall;
      const ended = callState === CallState.Ended;
      if (
        ended &&
        callEndedReason === CallEndedReason.RemoteHangupNeedPermission
      ) {
        return (
          <CallNeedPermissionScreen
            close={closeNeedPermissionScreen}
            conversation={conversation}
            i18n={i18n}
          />
        );
      }
      showCallLobby = !callState;
      isCallFull = false;
      groupMembers = undefined;
      break;
    }
    case CallMode.Group: {
      showCallLobby = activeCall.joinState !== GroupCallJoinState.Joined;
      isCallFull = activeCall.deviceCount >= activeCall.maxDevices;
      isConvoTooBigToRing = activeCall.isConversationTooBigToRing;
      ({ groupMembers } = activeCall);
      break;
    }
    default:
      throw missingCaseError(activeCall);
  }

  if (showCallLobby) {
    return (
      <>
        <CallingLobby
          availableCameras={availableCameras}
          conversation={conversation}
          groupMembers={groupMembers}
          hasLocalAudio={hasLocalAudio}
          hasLocalVideo={hasLocalVideo}
          i18n={i18n}
          isGroupCall={activeCall.callMode === CallMode.Group}
          isGroupCallOutboundRingEnabled={isGroupCallOutboundRingEnabled}
          isCallFull={isCallFull}
          isConversationTooBigToRing={isConvoTooBigToRing}
          me={me}
          onCallCanceled={cancelActiveCall}
          onJoinCall={joinActiveCall}
          outgoingRing={outgoingRing}
          peekedParticipants={peekedParticipants}
          setLocalPreview={setLocalPreview}
          setLocalAudio={setLocalAudio}
          setLocalVideo={setLocalVideo}
          setOutgoingRing={setOutgoingRing}
          showParticipantsList={showParticipantsList}
          toggleParticipants={toggleParticipants}
          toggleSettings={toggleSettings}
        />
        {settingsDialogOpen && renderDeviceSelection()}
        {showParticipantsList && activeCall.callMode === CallMode.Group ? (
          <CallingParticipantsList
            i18n={i18n}
            onClose={toggleParticipants}
            ourServiceId={me.serviceId}
            participants={peekedParticipants}
          />
        ) : null}
      </>
    );
  }

  if (pip) {
    return (
      <CallingPip
        activeCall={activeCall}
        getGroupCallVideoFrameSource={getGroupCallVideoFrameSourceForActiveCall}
        hangUpActiveCall={hangUpActiveCall}
        hasLocalVideo={hasLocalVideo}
        i18n={i18n}
        setGroupCallVideoRequest={setGroupCallVideoRequestForConversation}
        setLocalPreview={setLocalPreview}
        setRendererCanvas={setRendererCanvas}
        switchToPresentationView={switchToPresentationView}
        switchFromPresentationView={switchFromPresentationView}
        togglePip={togglePip}
      />
    );
  }

  const groupCallParticipantsForParticipantsList =
    activeCall.callMode === CallMode.Group
      ? [
          ...activeCall.remoteParticipants.map(participant => ({
            ...participant,
            hasRemoteAudio: participant.hasRemoteAudio,
            hasRemoteVideo: participant.hasRemoteVideo,
            presenting: participant.presenting,
          })),
          {
            ...me,
            hasRemoteAudio: hasLocalAudio,
            hasRemoteVideo: hasLocalVideo,
            presenting: Boolean(activeCall.presentingSource),
          },
        ]
      : [];

  return (
    <>
      <CallScreen
        activeCall={activeCall}
        changeCallView={changeCallView}
        getPresentingSources={getPresentingSources}
        getGroupCallVideoFrameSource={getGroupCallVideoFrameSourceForActiveCall}
        groupMembers={groupMembers}
        hangUpActiveCall={hangUpActiveCall}
        i18n={i18n}
        isGroupCallRaiseHandEnabled={isGroupCallRaiseHandEnabled}
        isGroupCallReactionsEnabled={isGroupCallReactionsEnabled}
        me={me}
        openSystemPreferencesAction={openSystemPreferencesAction}
        renderEmojiPicker={renderEmojiPicker}
        renderReactionPicker={renderReactionPicker}
        sendGroupCallRaiseHand={sendGroupCallRaiseHand}
        sendGroupCallReaction={sendGroupCallReaction}
        setGroupCallVideoRequest={setGroupCallVideoRequestForConversation}
        setLocalPreview={setLocalPreview}
        setRendererCanvas={setRendererCanvas}
        setLocalAudio={setLocalAudio}
        setLocalVideo={setLocalVideo}
        setPresenting={setPresenting}
        stickyControls={showParticipantsList}
        switchToPresentationView={switchToPresentationView}
        switchFromPresentationView={switchFromPresentationView}
        toggleScreenRecordingPermissionsDialog={
          toggleScreenRecordingPermissionsDialog
        }
        toggleParticipants={toggleParticipants}
        togglePip={togglePip}
        toggleSettings={toggleSettings}
      />
      {presentingSourcesAvailable && presentingSourcesAvailable.length ? (
        <CallingSelectPresentingSourcesModal
          i18n={i18n}
          presentingSourcesAvailable={presentingSourcesAvailable}
          setPresenting={setPresenting}
        />
      ) : null}
      {settingsDialogOpen && renderDeviceSelection()}
      {showParticipantsList && activeCall.callMode === CallMode.Group ? (
        <CallingParticipantsList
          i18n={i18n}
          onClose={toggleParticipants}
          ourServiceId={me.serviceId}
          participants={groupCallParticipantsForParticipantsList}
        />
      ) : null}
      {activeCall.callMode === CallMode.Group &&
      activeCall.conversationsWithSafetyNumberChanges.length ? (
        <SafetyNumberChangeDialog
          confirmText={i18n('icu:continueCall')}
          contacts={[
            {
              story: undefined,
              contacts: activeCall.conversationsWithSafetyNumberChanges,
            },
          ]}
          getPreferredBadge={getPreferredBadge}
          i18n={i18n}
          onCancel={onSafetyNumberDialogCancel}
          onConfirm={() => {
            keyChangeOk({ conversationId: activeCall.conversation.id });
          }}
          renderSafetyNumber={renderSafetyNumberViewer}
          theme={theme}
        />
      ) : null}
    </>
  );
}

export function CallManager(props: PropsType): JSX.Element | null {
  const {
    acceptCall,
    activeCall,
    bounceAppIconStart,
    bounceAppIconStop,
    declineCall,
    i18n,
    incomingCall,
    notifyForCall,
    playRingtone,
    stopRingtone,
    setIsCallActive,
    setOutgoingRing,
  } = props;

  const isCallActive = Boolean(activeCall);
  useEffect(() => {
    setIsCallActive(isCallActive);
  }, [isCallActive, setIsCallActive]);

  const shouldRing = getShouldRing(props);
  useEffect(() => {
    if (shouldRing) {
      playRingtone();
      return () => {
        stopRingtone();
      };
    }

    stopRingtone();
    return noop;
  }, [shouldRing, playRingtone, stopRingtone]);

  const mightBeRingingOutgoingGroupCall =
    activeCall?.callMode === CallMode.Group &&
    activeCall.outgoingRing &&
    activeCall.joinState !== GroupCallJoinState.NotJoined;
  useEffect(() => {
    if (!mightBeRingingOutgoingGroupCall) {
      return noop;
    }

    const timeout = setTimeout(() => {
      setOutgoingRing(false);
    }, GROUP_CALL_RING_DURATION);
    return () => {
      clearTimeout(timeout);
    };
  }, [mightBeRingingOutgoingGroupCall, setOutgoingRing]);

  if (activeCall) {
    // `props` should logically have an `activeCall` at this point, but TypeScript can't
    //   figure that out, so we pass it in again.
    return (
      <CallingToastProvider i18n={props.i18n}>
        <ActiveCallManager {...props} activeCall={activeCall} />
      </CallingToastProvider>
    );
  }

  // In the future, we may want to show the incoming call bar when a call is active.
  if (incomingCall) {
    return (
      <IncomingCallBar
        acceptCall={acceptCall}
        bounceAppIconStart={bounceAppIconStart}
        bounceAppIconStop={bounceAppIconStop}
        declineCall={declineCall}
        i18n={i18n}
        notifyForCall={notifyForCall}
        {...incomingCall}
      />
    );
  }

  return null;
}

function getShouldRing({
  activeCall,
  incomingCall,
  isConversationTooBigToRing,
}: Readonly<
  Pick<PropsType, 'activeCall' | 'incomingCall' | 'isConversationTooBigToRing'>
>): boolean {
  if (incomingCall) {
    // don't ring a large group
    if (isConversationTooBigToRing) {
      return false;
    }

    return !activeCall;
  }

  if (!activeCall) {
    return false;
  }

  switch (activeCall.callMode) {
    case CallMode.Direct:
      return (
        activeCall.callState === CallState.Prering ||
        activeCall.callState === CallState.Ringing
      );
    case CallMode.Group:
      return (
        activeCall.outgoingRing &&
        (activeCall.connectionState === GroupCallConnectionState.Connecting ||
          activeCall.connectionState === GroupCallConnectionState.Connected) &&
        activeCall.joinState !== GroupCallJoinState.NotJoined &&
        !activeCall.remoteParticipants.length &&
        (activeCall.conversation.sortedGroupMembers || []).length >= 2
      );
    default:
      throw missingCaseError(activeCall);
  }
}
