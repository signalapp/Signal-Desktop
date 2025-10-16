// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useEffect } from 'react';
import lodash from 'lodash';
import type { VideoFrameSource } from '@signalapp/ringrtc';
import { CallNeedPermissionScreen } from './CallNeedPermissionScreen.dom.js';
import { CallScreen } from './CallScreen.dom.js';
import { CallingLobby } from './CallingLobby.dom.js';
import { CallingParticipantsList } from './CallingParticipantsList.dom.js';
import { CallingSelectPresentingSourcesModal } from './CallingSelectPresentingSourcesModal.dom.js';
import { CallingPip } from './CallingPip.dom.js';
import { IncomingCallBar } from './IncomingCallBar.dom.js';
import type {
  ActiveCallType,
  CallViewMode,
  GroupCallConnectionState,
  GroupCallVideoRequest,
} from '../types/Calling.std.js';
import {
  CallEndedReason,
  CallState,
  GroupCallJoinState,
} from '../types/Calling.std.js';
import { CallMode } from '../types/CallDisposition.std.js';
import type { ConversationType } from '../state/ducks/conversations.preload.js';
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
  SetMutedByType,
  SetLocalVideoType,
  SetRendererCanvasType,
  StartCallType,
} from '../state/ducks/calling.preload.js';
import { CallLinkRestrictions } from '../types/CallLink.std.js';
import type { CallLinkType } from '../types/CallLink.std.js';
import type { LocalizerType } from '../types/Util.std.js';
import { missingCaseError } from '../util/missingCaseError.std.js';
import { CallingToastProvider } from './CallingToast.dom.js';
import type { SmartReactionPicker } from '../state/smart/ReactionPicker.dom.js';
import { createLogger } from '../logging/log.std.js';
import { isGroupOrAdhocActiveCall } from '../util/isGroupOrAdhocCall.std.js';
import { CallingAdhocCallInfo } from './CallingAdhocCallInfo.dom.js';
import { callLinkRootKeyToUrl } from '../util/callLinkRootKeyToUrl.std.js';
import { usePrevious } from '../hooks/usePrevious.std.js';
import { copyCallLink } from '../util/copyLinksWithToast.dom.js';
import {
  redactNotificationProfileId,
  shouldNotify,
} from '../types/NotificationProfile.std.js';
import type { NotificationProfileType } from '../types/NotificationProfile.std.js';
import { strictAssert } from '../util/assert.std.js';

const { noop } = lodash;

const log = createLogger('CallManager');

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
  activeNotificationProfile: NotificationProfileType | undefined;
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
  isOnline: boolean;
  ringingCall: DirectIncomingCall | GroupIncomingCall | null;
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
  cancelPresenting: () => void;
  declineCall: (_: DeclineCallType) => void;
  denyUser: (payload: PendingUserActionPayloadType) => void;
  hasInitialLoadCompleted: boolean;
  i18n: LocalizerType;
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
  selectPresentingSource: (id: string) => void;
  sendGroupCallRaiseHand: (payload: SendGroupCallRaiseHandType) => void;
  sendGroupCallReaction: (payload: SendGroupCallReactionType) => void;
  setGroupCallVideoRequest: (_: SetGroupCallVideoRequestType) => void;
  setIsCallActive: (_: boolean) => void;
  setLocalAudio: SetLocalAudioType;
  setLocalVideo: SetLocalVideoType;
  setLocalAudioRemoteMuted: SetMutedByType;
  setLocalPreviewContainer: (container: HTMLDivElement | null) => void;
  setOutgoingRing: (_: boolean) => void;
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
  toggleCallLinkPendingParticipantModal: (contactId: string) => void;
  toggleScreenRecordingPermissionsDialog: () => unknown;
  toggleSelfViewExpanded: () => unknown;
  toggleSettings: () => void;
  pauseVoiceNotePlayer: () => void;
};

type ActiveCallManagerPropsType = {
  activeCall: ActiveCallType;
} & Omit<
  PropsType,
  | 'acceptCall'
  | 'activeNotificationProfile'
  | 'bounceAppIconStart'
  | 'bounceAppIconStop'
  | 'declineCall'
  | 'hasInitialLoadCompleted'
  | 'notifyForCall'
  | 'playRingtone'
  | 'ringingCall'
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
  cancelPresenting,
  changeCallView,
  closeNeedPermissionScreen,
  denyUser,
  hangUpActiveCall,
  i18n,
  isOnline,
  getIsSharingPhoneNumberWithEverybody,
  getGroupCallVideoFrameSource,
  getPresentingSources,
  me,
  openSystemPreferencesAction,
  renderDeviceSelection,
  renderReactionPicker,
  removeClient,
  selectPresentingSource,
  sendGroupCallRaiseHand,
  sendGroupCallReaction,
  setGroupCallVideoRequest,
  setLocalAudio,
  setLocalAudioRemoteMuted,
  setLocalPreviewContainer,
  setLocalVideo,
  setRendererCanvas,
  setOutgoingRing,
  showContactModal,
  showShareCallLinkViaSignal,
  startCall,
  switchToPresentationView,
  switchFromPresentationView,
  toggleCallLinkPendingParticipantModal,
  toggleParticipants,
  togglePip,
  toggleScreenRecordingPermissionsDialog,
  toggleSelfViewExpanded,
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
    strictAssert(callLink != null, 'Missing call link');
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
        i18n={i18n}
        me={me}
        setGroupCallVideoRequest={setGroupCallVideoRequestForConversation}
        setLocalPreviewContainer={setLocalPreviewContainer}
        setRendererCanvas={setRendererCanvas}
        switchToPresentationView={switchToPresentationView}
        switchFromPresentationView={switchFromPresentationView}
        toggleAudio={setLocalAudio}
        togglePip={togglePip}
        toggleVideo={() => {
          const enabled = !activeCall.hasLocalVideo;
          setLocalVideo({ enabled });
        }}
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
          isOnline={isOnline}
          getIsSharingPhoneNumberWithEverybody={
            getIsSharingPhoneNumberWithEverybody
          }
          me={me}
          onCallCanceled={cancelActiveCall}
          onJoinCall={joinActiveCall}
          outgoingRing={outgoingRing}
          peekedParticipants={peekedParticipants}
          setLocalPreviewContainer={setLocalPreviewContainer}
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
        cancelPresenting={cancelPresenting}
        changeCallView={changeCallView}
        denyUser={denyUser}
        getPresentingSources={getPresentingSources}
        getGroupCallVideoFrameSource={getGroupCallVideoFrameSourceForActiveCall}
        groupMembers={groupMembers}
        hangUpActiveCall={hangUpActiveCall}
        i18n={i18n}
        imageDataCache={imageDataCache}
        isCallLinkAdmin={isCallLinkAdmin}
        me={me}
        openSystemPreferencesAction={openSystemPreferencesAction}
        renderReactionPicker={renderReactionPicker}
        sendGroupCallRaiseHand={sendGroupCallRaiseHand}
        sendGroupCallReaction={sendGroupCallReaction}
        setGroupCallVideoRequest={setGroupCallVideoRequestForConversation}
        setLocalPreviewContainer={setLocalPreviewContainer}
        setRendererCanvas={setRendererCanvas}
        setLocalAudio={setLocalAudio}
        setLocalAudioRemoteMuted={setLocalAudioRemoteMuted}
        setLocalVideo={setLocalVideo}
        stickyControls={showParticipantsList}
        switchToPresentationView={switchToPresentationView}
        switchFromPresentationView={switchFromPresentationView}
        toggleCallLinkPendingParticipantModal={
          toggleCallLinkPendingParticipantModal
        }
        toggleScreenRecordingPermissionsDialog={
          toggleScreenRecordingPermissionsDialog
        }
        toggleParticipants={toggleParticipants}
        togglePip={togglePip}
        toggleSelfViewExpanded={toggleSelfViewExpanded}
        toggleSettings={toggleSettings}
      />
      {presentingSourcesAvailable && presentingSourcesAvailable.length ? (
        <CallingSelectPresentingSourcesModal
          i18n={i18n}
          presentingSourcesAvailable={presentingSourcesAvailable}
          selectPresentingSource={selectPresentingSource}
          cancelPresenting={cancelPresenting}
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
  activeNotificationProfile,
  approveUser,
  availableCameras,
  batchUserAction,
  blockClient,
  bounceAppIconStart,
  bounceAppIconStop,
  callLink,
  cancelCall,
  cancelPresenting,
  changeCallView,
  closeNeedPermissionScreen,
  declineCall,
  denyUser,
  getGroupCallVideoFrameSource,
  getPresentingSources,
  hangUpActiveCall,
  hasInitialLoadCompleted,
  i18n,
  isOnline,
  getIsSharingPhoneNumberWithEverybody,
  me,
  notifyForCall,
  openSystemPreferencesAction,
  pauseVoiceNotePlayer,
  playRingtone,
  removeClient,
  renderDeviceSelection,
  renderReactionPicker,
  ringingCall,
  selectPresentingSource,
  sendGroupCallRaiseHand,
  sendGroupCallReaction,
  setGroupCallVideoRequest,
  setIsCallActive,
  setLocalAudio,
  setLocalAudioRemoteMuted,
  setLocalPreviewContainer,
  setLocalVideo,
  setOutgoingRing,
  setRendererCanvas,
  showContactModal,
  showShareCallLinkViaSignal,
  startCall,
  stopRingtone,
  switchFromPresentationView,
  switchToPresentationView,
  toggleParticipants,
  togglePip,
  toggleCallLinkPendingParticipantModal,
  toggleScreenRecordingPermissionsDialog,
  toggleSelfViewExpanded,
  toggleSettings,
}: PropsType): JSX.Element | null {
  const isCallActive = Boolean(activeCall);
  useEffect(() => {
    setIsCallActive(isCallActive);
  }, [isCallActive, setIsCallActive]);

  // It's important not to use the ringingCall itself, because that changes
  const ringingCallId = ringingCall?.conversation.id;
  useEffect(() => {
    if (hasInitialLoadCompleted && ringingCallId) {
      if (
        !shouldNotify({
          activeProfile: activeNotificationProfile,
          conversationId: ringingCallId,
          isCall: true,
          isMention: false,
        })
      ) {
        const redactedId = redactNotificationProfileId(
          activeNotificationProfile?.id ?? ''
        );
        log.info(
          `Would play ringtone, but notification profile ${redactedId} prevented it`
        );
        return;
      }

      log.info('Playing ringtone');
      playRingtone();

      return () => {
        log.info('Stopping ringtone');
        stopRingtone();
      };
    }

    stopRingtone();
    return noop;
  }, [
    activeNotificationProfile,
    hasInitialLoadCompleted,
    playRingtone,
    ringingCallId,
    stopRingtone,
  ]);

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
          cancelPresenting={cancelPresenting}
          changeCallView={changeCallView}
          closeNeedPermissionScreen={closeNeedPermissionScreen}
          denyUser={denyUser}
          getGroupCallVideoFrameSource={getGroupCallVideoFrameSource}
          getPresentingSources={getPresentingSources}
          hangUpActiveCall={hangUpActiveCall}
          i18n={i18n}
          isOnline={isOnline}
          getIsSharingPhoneNumberWithEverybody={
            getIsSharingPhoneNumberWithEverybody
          }
          me={me}
          openSystemPreferencesAction={openSystemPreferencesAction}
          pauseVoiceNotePlayer={pauseVoiceNotePlayer}
          removeClient={removeClient}
          renderDeviceSelection={renderDeviceSelection}
          renderReactionPicker={renderReactionPicker}
          selectPresentingSource={selectPresentingSource}
          sendGroupCallRaiseHand={sendGroupCallRaiseHand}
          sendGroupCallReaction={sendGroupCallReaction}
          setGroupCallVideoRequest={setGroupCallVideoRequest}
          setLocalAudio={setLocalAudio}
          setLocalAudioRemoteMuted={setLocalAudioRemoteMuted}
          setLocalPreviewContainer={setLocalPreviewContainer}
          setLocalVideo={setLocalVideo}
          setOutgoingRing={setOutgoingRing}
          setRendererCanvas={setRendererCanvas}
          showContactModal={showContactModal}
          showShareCallLinkViaSignal={showShareCallLinkViaSignal}
          startCall={startCall}
          switchFromPresentationView={switchFromPresentationView}
          switchToPresentationView={switchToPresentationView}
          toggleCallLinkPendingParticipantModal={
            toggleCallLinkPendingParticipantModal
          }
          toggleParticipants={toggleParticipants}
          togglePip={togglePip}
          toggleScreenRecordingPermissionsDialog={
            toggleScreenRecordingPermissionsDialog
          }
          toggleSelfViewExpanded={toggleSelfViewExpanded}
          toggleSettings={toggleSettings}
        />
      </CallingToastProvider>
    );
  }

  // In the future, we may want to show the incoming call bar when a call is active.
  if (ringingCall) {
    if (
      !shouldNotify({
        isCall: true,
        isMention: false,
        conversationId: ringingCall.conversation.id,
        activeProfile: activeNotificationProfile,
      })
    ) {
      const redactedId = redactNotificationProfileId(
        activeNotificationProfile?.id ?? ''
      );
      log.info(
        `Would show incoming call bar, but notification profile ${redactedId} prevented it`
      );
      return null;
    }

    return (
      <IncomingCallBar
        acceptCall={acceptCall}
        bounceAppIconStart={bounceAppIconStart}
        bounceAppIconStop={bounceAppIconStop}
        declineCall={declineCall}
        i18n={i18n}
        notifyForCall={notifyForCall}
        {...ringingCall}
      />
    );
  }

  return null;
}
