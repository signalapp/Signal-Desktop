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
import type {
  ActiveCallType,
  CallingConversationType,
  CallViewMode,
  GroupCallVideoRequest,
  PresentedSource,
} from '../types/Calling';
import {
  CallEndedReason,
  CallState,
  GroupCallConnectionState,
  GroupCallJoinState,
} from '../types/Calling';
import { CallMode } from '../types/CallDisposition';
import type { ConversationType } from '../state/ducks/conversations';
import type {
  AcceptCallType,
  BatchUserActionPayloadType,
  CancelCallType,
  DeclineCallType,
  GroupCallParticipantInfoType,
  PendingUserActionPayloadType,
  RemoveClientType,
  SendGroupCallRaiseHandType,
  SendGroupCallReactionType,
  SetGroupCallVideoRequestType,
  SetLocalAudioType,
  SetLocalPreviewType,
  SetLocalVideoType,
  SetRendererCanvasType,
  StartCallType,
} from '../state/ducks/calling';
import { CallLinkRestrictions } from '../types/CallLink';
import type { CallLinkType } from '../types/CallLink';
import type { LocalizerType } from '../types/Util';
import { missingCaseError } from '../util/missingCaseError';
import { CallingToastProvider } from './CallingToast';
import type { SmartReactionPicker } from '../state/smart/ReactionPicker';
import type { Props as ReactionPickerProps } from './conversation/ReactionPicker';
import * as log from '../logging/log';
import { isGroupOrAdhocActiveCall } from '../util/isGroupOrAdhocCall';
import { CallingAdhocCallInfo } from './CallingAdhocCallInfo';
import { callLinkRootKeyToUrl } from '../util/callLinkRootKeyToUrl';
import { usePrevious } from '../hooks/usePrevious';
import { copyCallLink } from '../util/copyLinksWithToast';

const GROUP_CALL_RING_DURATION = 60 * 1000;

export type DirectIncomingCall = Readonly<{
  callMode: CallMode.Direct;
  callState?: CallState;
  callEndedReason?: CallEndedReason;
  conversation: ConversationType;
  isVideoCall: boolean;
}>;

export type GroupIncomingCall = Readonly<{
  callMode: CallMode.Group;
  connectionState: GroupCallConnectionState;
  joinState: GroupCallJoinState;
  conversation: ConversationType;
  otherMembersRung: Array<Pick<ConversationType, 'firstName' | 'title'>>;
  ringer: Pick<ConversationType, 'firstName' | 'title'>;
  remoteParticipants: Array<GroupCallParticipantInfoType>;
}>;

export type CallingImageDataCache = Map<number, ImageData>;

export type PropsType = {
  activeCall?: ActiveCallType;
  availableCameras: Array<MediaDeviceInfo>;
  callLink: CallLinkType | undefined;
  cancelCall: (_: CancelCallType) => void;
  changeCallView: (mode: CallViewMode) => void;
  closeNeedPermissionScreen: () => void;
  getGroupCallVideoFrameSource: (
    conversationId: string,
    demuxId: number
  ) => VideoFrameSource;
  getIsSharingPhoneNumberWithEverybody: () => boolean;
  getPresentingSources: () => void;
  incomingCall: DirectIncomingCall | GroupIncomingCall | null;
  renderDeviceSelection: () => JSX.Element;
  renderReactionPicker: (
    props: React.ComponentProps<typeof SmartReactionPicker>
  ) => JSX.Element;
  showContactModal: (contactId: string, conversationId?: string) => void;
  startCall: (payload: StartCallType) => void;
  toggleParticipants: () => void;
  acceptCall: (_: AcceptCallType) => void;
  approveUser: (payload: PendingUserActionPayloadType) => void;
  batchUserAction: (payload: BatchUserActionPayloadType) => void;
  bounceAppIconStart: () => unknown;
  bounceAppIconStop: () => unknown;
  declineCall: (_: DeclineCallType) => void;
  denyUser: (payload: PendingUserActionPayloadType) => void;
  hasInitialLoadCompleted: boolean;
  i18n: LocalizerType;
  isGroupCallRaiseHandEnabled: boolean;
  me: ConversationType;
  notifyForCall: (
    conversationId: string,
    title: string,
    isVideoCall: boolean
  ) => unknown;
  openSystemPreferencesAction: () => unknown;
  playRingtone: () => unknown;
  removeClient: (payload: RemoveClientType) => void;
  blockClient: (payload: RemoveClientType) => void;
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
  showShareCallLinkViaSignal: (
    callLink: CallLinkType,
    i18n: LocalizerType
  ) => void;
  stopRingtone: () => unknown;
  switchToPresentationView: () => void;
  switchFromPresentationView: () => void;
  hangUpActiveCall: (reason: string) => void;
  togglePip: () => void;
  toggleScreenRecordingPermissionsDialog: () => unknown;
  toggleSettings: () => void;
  isConversationTooBigToRing: boolean;
  pauseVoiceNotePlayer: () => void;
} & Pick<ReactionPickerProps, 'renderEmojiPicker'>;

type ActiveCallManagerPropsType = {
  activeCall: ActiveCallType;
} & Omit<
  PropsType,
  | 'acceptCall'
  | 'bounceAppIconStart'
  | 'bounceAppIconStop'
  | 'declineCall'
  | 'hasInitialLoadCompleted'
  | 'incomingCall'
  | 'notifyForCall'
  | 'playRingtone'
  | 'setIsCallActive'
  | 'stopRingtone'
  | 'isConversationTooBigToRing'
>;

function ActiveCallManager({
  activeCall,
  approveUser,
  availableCameras,
  batchUserAction,
  blockClient,
  callLink,
  cancelCall,
  changeCallView,
  closeNeedPermissionScreen,
  denyUser,
  hangUpActiveCall,
  i18n,
  isGroupCallRaiseHandEnabled,
  getIsSharingPhoneNumberWithEverybody,
  getGroupCallVideoFrameSource,
  getPresentingSources,
  me,
  openSystemPreferencesAction,
  renderDeviceSelection,
  renderEmojiPicker,
  renderReactionPicker,
  removeClient,
  sendGroupCallRaiseHand,
  sendGroupCallReaction,
  setGroupCallVideoRequest,
  setLocalAudio,
  setLocalPreview,
  setLocalVideo,
  setPresenting,
  setRendererCanvas,
  setOutgoingRing,
  showContactModal,
  showShareCallLinkViaSignal,
  startCall,
  switchToPresentationView,
  switchFromPresentationView,
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

  // For caching screenshare frames which update slowly, between Pip and CallScreen.
  const imageDataCache = React.useRef<CallingImageDataCache>(new Map());

  const previousConversationId = usePrevious(conversation.id, conversation.id);
  useEffect(() => {
    if (conversation.id !== previousConversationId) {
      imageDataCache.current.clear();
    }
  }, [conversation.id, previousConversationId]);

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

  const onCopyCallLink = useCallback(async () => {
    if (!callLink) {
      return;
    }

    const link = callLinkRootKeyToUrl(callLink.rootKey);
    if (link) {
      await copyCallLink(link);
    }
  }, [callLink]);

  const handleShareCallLinkViaSignal = useCallback(() => {
    if (!callLink) {
      log.error('Missing call link');
      return;
    }

    showShareCallLinkViaSignal(callLink, i18n);
  }, [callLink, i18n, showShareCallLinkViaSignal]);

  let isCallFull: boolean;
  let showCallLobby: boolean;
  let groupMembers:
    | undefined
    | Array<Pick<ConversationType, 'id' | 'firstName' | 'title'>>;
  let isConvoTooBigToRing = false;
  let isAdhocAdminApprovalRequired = false;
  let isAdhocJoinRequestPending = false;
  let isCallLinkAdmin = false;

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
    case CallMode.Group:
    case CallMode.Adhoc: {
      showCallLobby = activeCall.joinState !== GroupCallJoinState.Joined;
      isCallFull = activeCall.deviceCount >= activeCall.maxDevices;
      isConvoTooBigToRing = activeCall.isConversationTooBigToRing;
      ({ groupMembers } = activeCall);
      isAdhocAdminApprovalRequired =
        !callLink?.adminKey &&
        callLink?.restrictions === CallLinkRestrictions.AdminApproval;
      isAdhocJoinRequestPending =
        isAdhocAdminApprovalRequired &&
        activeCall.joinState === GroupCallJoinState.Pending;
      isCallLinkAdmin = Boolean(callLink?.adminKey);
      break;
    }
    default:
      throw missingCaseError(activeCall);
  }

  if (pip) {
    return (
      <CallingPip
        activeCall={activeCall}
        getGroupCallVideoFrameSource={getGroupCallVideoFrameSourceForActiveCall}
        imageDataCache={imageDataCache}
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

  if (showCallLobby) {
    return (
      <>
        <CallingLobby
          availableCameras={availableCameras}
          callMode={activeCall.callMode}
          conversation={conversation}
          groupMembers={groupMembers}
          hasLocalAudio={hasLocalAudio}
          hasLocalVideo={hasLocalVideo}
          i18n={i18n}
          isAdhocAdminApprovalRequired={isAdhocAdminApprovalRequired}
          isAdhocJoinRequestPending={isAdhocJoinRequestPending}
          isCallFull={isCallFull}
          isConversationTooBigToRing={isConvoTooBigToRing}
          getIsSharingPhoneNumberWithEverybody={
            getIsSharingPhoneNumberWithEverybody
          }
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
          togglePip={togglePip}
          toggleSettings={toggleSettings}
        />
        {settingsDialogOpen && renderDeviceSelection()}
        {showParticipantsList &&
          (activeCall.callMode === CallMode.Adhoc && callLink ? (
            <CallingAdhocCallInfo
              callLink={callLink}
              i18n={i18n}
              isCallLinkAdmin={isCallLinkAdmin}
              isUnknownContactDiscrete={false}
              ourServiceId={me.serviceId}
              participants={peekedParticipants}
              onClose={toggleParticipants}
              onCopyCallLink={onCopyCallLink}
              onShareCallLinkViaSignal={handleShareCallLinkViaSignal}
              removeClient={removeClient}
              blockClient={blockClient}
              showContactModal={showContactModal}
            />
          ) : (
            <CallingParticipantsList
              conversationId={conversation.id}
              i18n={i18n}
              onClose={toggleParticipants}
              ourServiceId={me.serviceId}
              participants={peekedParticipants}
              showContactModal={showContactModal}
            />
          ))}
      </>
    );
  }

  let isHandRaised = false;
  if (isGroupOrAdhocActiveCall(activeCall)) {
    const { raisedHands, localDemuxId } = activeCall;
    if (localDemuxId) {
      isHandRaised = raisedHands.has(localDemuxId);
    }
  }

  const groupCallParticipantsForParticipantsList = isGroupOrAdhocActiveCall(
    activeCall
  )
    ? [
        ...activeCall.remoteParticipants,
        {
          ...me,
          hasRemoteAudio: hasLocalAudio,
          hasRemoteVideo: hasLocalVideo,
          isHandRaised,
          presenting: Boolean(activeCall.presentingSource),
          demuxId: activeCall.localDemuxId,
        },
      ]
    : [];

  return (
    <>
      <CallScreen
        activeCall={activeCall}
        approveUser={approveUser}
        batchUserAction={batchUserAction}
        changeCallView={changeCallView}
        denyUser={denyUser}
        getPresentingSources={getPresentingSources}
        getGroupCallVideoFrameSource={getGroupCallVideoFrameSourceForActiveCall}
        groupMembers={groupMembers}
        hangUpActiveCall={hangUpActiveCall}
        i18n={i18n}
        imageDataCache={imageDataCache}
        isCallLinkAdmin={isCallLinkAdmin}
        isGroupCallRaiseHandEnabled={isGroupCallRaiseHandEnabled}
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
      {showParticipantsList &&
        (activeCall.callMode === CallMode.Adhoc && callLink ? (
          <CallingAdhocCallInfo
            callLink={callLink}
            i18n={i18n}
            isCallLinkAdmin={isCallLinkAdmin}
            isUnknownContactDiscrete
            ourServiceId={me.serviceId}
            participants={groupCallParticipantsForParticipantsList}
            onClose={toggleParticipants}
            onCopyCallLink={onCopyCallLink}
            onShareCallLinkViaSignal={handleShareCallLinkViaSignal}
            removeClient={removeClient}
            blockClient={blockClient}
            showContactModal={showContactModal}
          />
        ) : (
          <CallingParticipantsList
            conversationId={conversation.id}
            i18n={i18n}
            onClose={toggleParticipants}
            ourServiceId={me.serviceId}
            participants={groupCallParticipantsForParticipantsList}
            showContactModal={showContactModal}
          />
        ))}
    </>
  );
}

export function CallManager({
  acceptCall,
  activeCall,
  approveUser,
  availableCameras,
  batchUserAction,
  blockClient,
  bounceAppIconStart,
  bounceAppIconStop,
  callLink,
  cancelCall,
  changeCallView,
  closeNeedPermissionScreen,
  declineCall,
  denyUser,
  getGroupCallVideoFrameSource,
  getPresentingSources,
  hangUpActiveCall,
  hasInitialLoadCompleted,
  i18n,
  incomingCall,
  isConversationTooBigToRing,
  isGroupCallRaiseHandEnabled,
  getIsSharingPhoneNumberWithEverybody,
  me,
  notifyForCall,
  openSystemPreferencesAction,
  pauseVoiceNotePlayer,
  playRingtone,
  removeClient,
  renderDeviceSelection,
  renderEmojiPicker,
  renderReactionPicker,
  sendGroupCallRaiseHand,
  sendGroupCallReaction,
  setGroupCallVideoRequest,
  setIsCallActive,
  setLocalAudio,
  setLocalPreview,
  setLocalVideo,
  setOutgoingRing,
  setPresenting,
  setRendererCanvas,
  showContactModal,
  showShareCallLinkViaSignal,
  startCall,
  stopRingtone,
  switchFromPresentationView,
  switchToPresentationView,
  toggleParticipants,
  togglePip,
  toggleScreenRecordingPermissionsDialog,
  toggleSettings,
}: PropsType): JSX.Element | null {
  const isCallActive = Boolean(activeCall);
  useEffect(() => {
    setIsCallActive(isCallActive);
  }, [isCallActive, setIsCallActive]);

  const shouldRing = getShouldRing({
    activeCall,
    incomingCall,
    isConversationTooBigToRing,
    hasInitialLoadCompleted,
  });
  useEffect(() => {
    if (shouldRing) {
      log.info('CallManager: Playing ringtone');
      playRingtone();
      return () => {
        log.info('CallManager: Stopping ringtone');
        stopRingtone();
      };
    }

    stopRingtone();
    return noop;
  }, [shouldRing, playRingtone, stopRingtone]);

  const mightBeRingingOutgoingGroupCall =
    isGroupOrAdhocActiveCall(activeCall) &&
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
      <CallingToastProvider i18n={i18n}>
        <ActiveCallManager
          activeCall={activeCall}
          availableCameras={availableCameras}
          approveUser={approveUser}
          batchUserAction={batchUserAction}
          blockClient={blockClient}
          callLink={callLink}
          cancelCall={cancelCall}
          changeCallView={changeCallView}
          closeNeedPermissionScreen={closeNeedPermissionScreen}
          denyUser={denyUser}
          getGroupCallVideoFrameSource={getGroupCallVideoFrameSource}
          getPresentingSources={getPresentingSources}
          hangUpActiveCall={hangUpActiveCall}
          i18n={i18n}
          isGroupCallRaiseHandEnabled={isGroupCallRaiseHandEnabled}
          getIsSharingPhoneNumberWithEverybody={
            getIsSharingPhoneNumberWithEverybody
          }
          me={me}
          openSystemPreferencesAction={openSystemPreferencesAction}
          pauseVoiceNotePlayer={pauseVoiceNotePlayer}
          removeClient={removeClient}
          renderDeviceSelection={renderDeviceSelection}
          renderEmojiPicker={renderEmojiPicker}
          renderReactionPicker={renderReactionPicker}
          sendGroupCallRaiseHand={sendGroupCallRaiseHand}
          sendGroupCallReaction={sendGroupCallReaction}
          setGroupCallVideoRequest={setGroupCallVideoRequest}
          setLocalAudio={setLocalAudio}
          setLocalPreview={setLocalPreview}
          setLocalVideo={setLocalVideo}
          setOutgoingRing={setOutgoingRing}
          setPresenting={setPresenting}
          setRendererCanvas={setRendererCanvas}
          showContactModal={showContactModal}
          showShareCallLinkViaSignal={showShareCallLinkViaSignal}
          startCall={startCall}
          switchFromPresentationView={switchFromPresentationView}
          switchToPresentationView={switchToPresentationView}
          toggleParticipants={toggleParticipants}
          togglePip={togglePip}
          toggleScreenRecordingPermissionsDialog={
            toggleScreenRecordingPermissionsDialog
          }
          toggleSettings={toggleSettings}
        />
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

function isRinging(callState: CallState | undefined): boolean {
  return callState === CallState.Prering || callState === CallState.Ringing;
}

function isConnected(connectionState: GroupCallConnectionState): boolean {
  return (
    connectionState === GroupCallConnectionState.Connecting ||
    connectionState === GroupCallConnectionState.Connected
  );
}

function isJoined(joinState: GroupCallJoinState): boolean {
  return joinState !== GroupCallJoinState.NotJoined;
}

function hasRemoteParticipants(
  remoteParticipants: Array<GroupCallParticipantInfoType>
): boolean {
  return remoteParticipants.length > 0;
}

function isLonelyGroup(conversation: CallingConversationType): boolean {
  return (conversation.sortedGroupMembers?.length ?? 0) < 2;
}

function getShouldRing({
  activeCall,
  incomingCall,
  isConversationTooBigToRing,
  hasInitialLoadCompleted,
}: Readonly<
  Pick<
    PropsType,
    | 'activeCall'
    | 'incomingCall'
    | 'isConversationTooBigToRing'
    | 'hasInitialLoadCompleted'
  >
>): boolean {
  if (!hasInitialLoadCompleted) {
    return false;
  }

  if (incomingCall != null) {
    // don't ring a large group
    if (isConversationTooBigToRing) {
      return false;
    }

    if (activeCall != null) {
      return false;
    }

    if (incomingCall.callMode === CallMode.Direct) {
      return (
        isRinging(incomingCall.callState) &&
        incomingCall.callEndedReason == null
      );
    }

    if (incomingCall.callMode === CallMode.Group) {
      return (
        !isConnected(incomingCall.connectionState) &&
        !isJoined(incomingCall.joinState) &&
        !isLonelyGroup(incomingCall.conversation)
      );
    }

    // Adhoc calls can't be incoming.

    throw missingCaseError(incomingCall);
  }

  if (activeCall != null) {
    switch (activeCall.callMode) {
      case CallMode.Direct:
        return (
          activeCall.callState === CallState.Prering ||
          activeCall.callState === CallState.Ringing
        );
      case CallMode.Group:
      case CallMode.Adhoc:
        return (
          activeCall.outgoingRing &&
          isConnected(activeCall.connectionState) &&
          isJoined(activeCall.joinState) &&
          !hasRemoteParticipants(activeCall.remoteParticipants) &&
          !isLonelyGroup(activeCall.conversation)
        );
      default:
        throw missingCaseError(activeCall);
    }
  }

  return false;
}
