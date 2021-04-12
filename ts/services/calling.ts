// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable class-methods-use-this */

import {
  Call,
  CallEndedReason,
  CallId,
  CallingMessage,
  CallLogLevel,
  CallSettings,
  CallState,
  CanvasVideoRenderer,
  ConnectionState,
  JoinState,
  HttpMethod,
  DeviceId,
  GroupCall,
  GroupMemberInfo,
  GumVideoCapturer,
  HangupMessage,
  HangupType,
  OfferType,
  OpaqueMessage,
  PeekInfo,
  RingRTC,
  UserId,
  VideoFrameSource,
  VideoRequest,
  BandwidthMode,
} from 'ringrtc';
import { uniqBy, noop } from 'lodash';

import {
  ActionsType as UxActionsType,
  GroupCallPeekInfoType,
} from '../state/ducks/calling';
import { getConversationCallMode } from '../state/ducks/conversations';
import { EnvelopeClass } from '../textsecure.d';
import {
  CallMode,
  AudioDevice,
  MediaDeviceSettings,
  GroupCallConnectionState,
  GroupCallJoinState,
} from '../types/Calling';
import { ConversationModel } from '../models/conversations';
import {
  base64ToArrayBuffer,
  uuidToArrayBuffer,
  arrayBufferToUuid,
} from '../Crypto';
import { getOwn } from '../util/getOwn';
import {
  fetchMembershipProof,
  getMembershipList,
  wrapWithSyncMessageSend,
} from '../groups';
import { missingCaseError } from '../util/missingCaseError';
import { normalizeGroupCallTimestamp } from '../util/ringrtc/normalizeGroupCallTimestamp';
import {
  REQUESTED_VIDEO_WIDTH,
  REQUESTED_VIDEO_HEIGHT,
  REQUESTED_VIDEO_FRAMERATE,
} from '../calling/constants';

const RINGRTC_HTTP_METHOD_TO_OUR_HTTP_METHOD: Map<
  HttpMethod,
  'GET' | 'PUT' | 'POST' | 'DELETE'
> = new Map([
  [HttpMethod.Get, 'GET'],
  [HttpMethod.Put, 'PUT'],
  [HttpMethod.Post, 'POST'],
  [HttpMethod.Delete, 'DELETE'],
]);

// We send group call update messages to tell other clients to peek, which triggers
//   notifications, timeline messages, big green "Join" buttons, and so on. This enum
//   represents the three possible states we can be in. This helps ensure that we don't
//   send an update on disconnect if we never sent one when we joined.
enum GroupCallUpdateMessageState {
  SentNothing,
  SentJoin,
  SentLeft,
}

export class CallingClass {
  readonly videoCapturer: GumVideoCapturer;

  readonly videoRenderer: CanvasVideoRenderer;

  private uxActions?: UxActionsType;

  private sfuUrl?: string;

  private lastMediaDeviceSettings?: MediaDeviceSettings;

  private deviceReselectionTimer?: NodeJS.Timeout;

  private callsByConversation: { [conversationId: string]: Call | GroupCall };

  constructor() {
    this.videoCapturer = new GumVideoCapturer(
      REQUESTED_VIDEO_WIDTH,
      REQUESTED_VIDEO_HEIGHT,
      REQUESTED_VIDEO_FRAMERATE
    );
    this.videoRenderer = new CanvasVideoRenderer();

    this.callsByConversation = {};
  }

  initialize(uxActions: UxActionsType, sfuUrl: string): void {
    this.uxActions = uxActions;
    if (!uxActions) {
      throw new Error('CallingClass.initialize: Invalid uxActions.');
    }

    this.sfuUrl = sfuUrl;

    RingRTC.handleOutgoingSignaling = this.handleOutgoingSignaling.bind(this);
    RingRTC.handleIncomingCall = this.handleIncomingCall.bind(this);
    RingRTC.handleAutoEndedIncomingCallRequest = this.handleAutoEndedIncomingCallRequest.bind(
      this
    );
    RingRTC.handleLogMessage = this.handleLogMessage.bind(this);
    RingRTC.handleSendHttpRequest = this.handleSendHttpRequest.bind(this);
    RingRTC.handleSendCallMessage = this.handleSendCallMessage.bind(this);
  }

  async startCallingLobby(
    conversationId: string,
    isVideoCall: boolean
  ): Promise<void> {
    window.log.info('CallingClass.startCallingLobby()');

    const conversation = window.ConversationController.get(conversationId);
    if (!conversation) {
      window.log.error('Could not find conversation, cannot start call lobby');
      return;
    }

    const conversationProps = conversation.format();
    const callMode = getConversationCallMode(conversationProps);
    switch (callMode) {
      case CallMode.None:
        window.log.error(
          'Conversation does not support calls, new call not allowed.'
        );
        return;
      case CallMode.Direct:
        if (!this.getRemoteUserIdFromConversation(conversation)) {
          window.log.error(
            'Missing remote user identifier, new call not allowed.'
          );
          return;
        }
        break;
      case CallMode.Group:
        break;
      default:
        throw missingCaseError(callMode);
    }

    if (!this.uxActions) {
      window.log.error('Missing uxActions, new call not allowed.');
      return;
    }

    if (!this.localDeviceId) {
      window.log.error(
        'Missing local device identifier, new call not allowed.'
      );
      return;
    }

    const haveMediaPermissions = await this.requestPermissions(isVideoCall);
    if (!haveMediaPermissions) {
      window.log.info('Permissions were denied, new call not allowed.');
      return;
    }

    window.log.info('CallingClass.startCallingLobby(): Starting lobby');

    // It's important that this function comes before any calls to
    //   `videoCapturer.enableCapture` or `videoCapturer.enableCaptureAndSend` because of
    //   a small RingRTC bug.
    //
    // If we tell RingRTC to start capturing video (with those methods or with
    //   `RingRTC.setPreferredDevice`, which also captures video) multiple times in quick
    //   succession, it will call the asynchronous `getUserMedia` twice. It'll save the
    //   results in the same variable, which means the first call can be overridden.
    //   Later, when we try to turn the camera off, we'll only disable the *second* result
    //   of `getUserMedia` and the camera will stay on.
    //
    // We get around this by `await`ing, making sure we're all done with `getUserMedia`,
    //   and then continuing.
    //
    // We should be able to move this below `this.connectGroupCall` once that RingRTC bug
    //   is fixed. See DESKTOP-1032.
    await this.startDeviceReselectionTimer();

    switch (callMode) {
      case CallMode.Direct:
        this.uxActions.showCallLobby({
          callMode: CallMode.Direct,
          conversationId: conversationProps.id,
          hasLocalAudio: true,
          hasLocalVideo: isVideoCall,
        });
        break;
      case CallMode.Group: {
        if (
          !conversationProps.groupId ||
          !conversationProps.publicParams ||
          !conversationProps.secretParams
        ) {
          window.log.error(
            'Conversation is missing required parameters. Cannot connect group call'
          );
          return;
        }
        const groupCall = this.connectGroupCall(conversationProps.id, {
          groupId: conversationProps.groupId,
          publicParams: conversationProps.publicParams,
          secretParams: conversationProps.secretParams,
        });

        groupCall.setOutgoingAudioMuted(false);
        groupCall.setOutgoingVideoMuted(!isVideoCall);

        this.uxActions.showCallLobby({
          callMode: CallMode.Group,
          conversationId: conversationProps.id,
          ...this.formatGroupCallForRedux(groupCall),
        });
        break;
      }
      default:
        throw missingCaseError(callMode);
    }

    if (isVideoCall) {
      this.enableLocalCamera();
    }
  }

  stopCallingLobby(conversationId?: string): void {
    this.disableLocalCamera();
    this.stopDeviceReselectionTimer();
    this.lastMediaDeviceSettings = undefined;

    if (conversationId) {
      this.getGroupCall(conversationId)?.disconnect();
    }
  }

  async startOutgoingDirectCall(
    conversationId: string,
    hasLocalAudio: boolean,
    hasLocalVideo: boolean
  ): Promise<void> {
    window.log.info('CallingClass.startOutgoingDirectCall()');

    if (!this.uxActions) {
      throw new Error('Redux actions not available');
    }

    const conversation = window.ConversationController.get(conversationId);

    if (!conversation) {
      window.log.error('Could not find conversation, cannot start call');
      this.stopCallingLobby();
      return;
    }

    const remoteUserId = this.getRemoteUserIdFromConversation(conversation);
    if (!remoteUserId || !this.localDeviceId) {
      window.log.error('Missing identifier, new call not allowed.');
      this.stopCallingLobby();
      return;
    }

    const haveMediaPermissions = await this.requestPermissions(hasLocalVideo);
    if (!haveMediaPermissions) {
      window.log.info('Permissions were denied, new call not allowed.');
      this.stopCallingLobby();
      return;
    }

    window.log.info(
      'CallingClass.startOutgoingDirectCall(): Getting call settings'
    );

    const callSettings = await this.getCallSettings(conversation);

    // Check state after awaiting to debounce call button.
    if (RingRTC.call && RingRTC.call.state !== CallState.Ended) {
      window.log.info('Call already in progress, new call not allowed.');
      this.stopCallingLobby();
      return;
    }

    window.log.info(
      'CallingClass.startOutgoingDirectCall(): Starting in RingRTC'
    );

    // We could make this faster by getting the call object
    // from the RingRTC before we lookup the ICE servers.
    const call = RingRTC.startOutgoingCall(
      remoteUserId,
      hasLocalVideo,
      this.localDeviceId,
      callSettings
    );

    RingRTC.setOutgoingAudio(call.callId, hasLocalAudio);
    RingRTC.setVideoCapturer(call.callId, this.videoCapturer);
    RingRTC.setVideoRenderer(call.callId, this.videoRenderer);
    this.attachToCall(conversation, call);

    this.uxActions.outgoingCall({
      conversationId: conversation.id,
      hasLocalAudio,
      hasLocalVideo,
    });

    await this.startDeviceReselectionTimer();
  }

  private getDirectCall(conversationId: string): undefined | Call {
    const call = getOwn(this.callsByConversation, conversationId);
    return call instanceof Call ? call : undefined;
  }

  private getGroupCall(conversationId: string): undefined | GroupCall {
    const call = getOwn(this.callsByConversation, conversationId);
    return call instanceof GroupCall ? call : undefined;
  }

  private getGroupCallMembers(conversationId: string) {
    return getMembershipList(conversationId).map(
      member =>
        new GroupMemberInfo(
          uuidToArrayBuffer(member.uuid),
          member.uuidCiphertext
        )
    );
  }

  public async peekGroupCall(conversationId: string): Promise<PeekInfo> {
    // This can be undefined in two cases:
    //
    // 1. There is no group call instance. This is "stateless peeking", and is expected
    //    when we want to peek on a call that we've never connected to.
    // 2. There is a group call instance but RingRTC doesn't have the peek info yet. This
    //    should only happen for a brief period as you connect to the call. (You probably
    //    don't want to call this function while a group call is connected—you should
    //    instead be grabbing the peek info off of the instance—but we handle it here
    //    to avoid possible race conditions.)
    const statefulPeekInfo = this.getGroupCall(conversationId)?.getPeekInfo();
    if (statefulPeekInfo) {
      return statefulPeekInfo;
    }

    if (!this.sfuUrl) {
      throw new Error('Missing SFU URL; not peeking group call');
    }

    const conversation = window.ConversationController.get(conversationId);
    if (!conversation) {
      throw new Error('Missing conversation; not peeking group call');
    }
    const publicParams = conversation.get('publicParams');
    const secretParams = conversation.get('secretParams');
    if (!publicParams || !secretParams) {
      throw new Error(
        'Conversation is missing required parameters. Cannot peek group call'
      );
    }

    const proof = await fetchMembershipProof({ publicParams, secretParams });
    if (!proof) {
      throw new Error('No membership proof. Cannot peek group call');
    }
    const membershipProof = new TextEncoder().encode(proof).buffer;

    return RingRTC.peekGroupCall(
      this.sfuUrl,
      membershipProof,
      this.getGroupCallMembers(conversationId)
    );
  }

  /**
   * Connect to a conversation's group call and connect it to Redux.
   *
   * Should only be called with group call-compatible conversations.
   *
   * Idempotent.
   */
  connectGroupCall(
    conversationId: string,
    {
      groupId,
      publicParams,
      secretParams,
    }: {
      groupId: string;
      publicParams: string;
      secretParams: string;
    }
  ): GroupCall {
    const existing = this.getGroupCall(conversationId);
    if (existing) {
      const isExistingCallNotConnected =
        existing.getLocalDeviceState().connectionState ===
        ConnectionState.NotConnected;
      if (isExistingCallNotConnected) {
        existing.connect();
      }
      return existing;
    }

    if (!this.sfuUrl) {
      throw new Error('Missing SFU URL; not connecting group call');
    }

    const groupIdBuffer = base64ToArrayBuffer(groupId);

    let updateMessageState = GroupCallUpdateMessageState.SentNothing;
    let isRequestingMembershipProof = false;

    const outerGroupCall = RingRTC.getGroupCall(groupIdBuffer, this.sfuUrl, {
      onLocalDeviceStateChanged: groupCall => {
        const localDeviceState = groupCall.getLocalDeviceState();
        const { eraId } = groupCall.getPeekInfo() || {};

        if (localDeviceState.connectionState === ConnectionState.NotConnected) {
          // NOTE: This assumes that only one call is active at a time. For example, if
          //   there are two calls using the camera, this will disable both of them.
          //   That's fine for now, but this will break if that assumption changes.
          this.disableLocalCamera();

          delete this.callsByConversation[conversationId];

          if (
            updateMessageState === GroupCallUpdateMessageState.SentJoin &&
            eraId
          ) {
            updateMessageState = GroupCallUpdateMessageState.SentLeft;
            this.sendGroupCallUpdateMessage(conversationId, eraId);
          }
        } else {
          this.callsByConversation[conversationId] = groupCall;

          // NOTE: This assumes only one active call at a time. See comment above.
          if (localDeviceState.videoMuted) {
            this.disableLocalCamera();
          } else {
            this.videoCapturer.enableCaptureAndSend(groupCall);
          }

          if (
            updateMessageState === GroupCallUpdateMessageState.SentNothing &&
            localDeviceState.joinState === JoinState.Joined &&
            eraId
          ) {
            updateMessageState = GroupCallUpdateMessageState.SentJoin;
            this.sendGroupCallUpdateMessage(conversationId, eraId);
          }
        }

        this.syncGroupCallToRedux(conversationId, groupCall);
      },
      onRemoteDeviceStatesChanged: groupCall => {
        this.syncGroupCallToRedux(conversationId, groupCall);
      },
      onPeekChanged: groupCall => {
        const localDeviceState = groupCall.getLocalDeviceState();
        const { eraId } = groupCall.getPeekInfo() || {};
        if (
          updateMessageState === GroupCallUpdateMessageState.SentNothing &&
          localDeviceState.connectionState !== ConnectionState.NotConnected &&
          localDeviceState.joinState === JoinState.Joined &&
          eraId
        ) {
          updateMessageState = GroupCallUpdateMessageState.SentJoin;
          this.sendGroupCallUpdateMessage(conversationId, eraId);
        }

        this.updateCallHistoryForGroupCall(
          conversationId,
          groupCall.getPeekInfo()
        );
        this.syncGroupCallToRedux(conversationId, groupCall);
      },
      async requestMembershipProof(groupCall) {
        if (isRequestingMembershipProof) {
          return;
        }
        isRequestingMembershipProof = true;
        try {
          const proof = await fetchMembershipProof({
            publicParams,
            secretParams,
          });
          if (proof) {
            const proofArray = new TextEncoder().encode(proof);
            groupCall.setMembershipProof(proofArray.buffer);
          }
        } catch (err) {
          window.log.error('Failed to fetch membership proof', err);
        } finally {
          isRequestingMembershipProof = false;
        }
      },
      requestGroupMembers: groupCall => {
        groupCall.setGroupMembers(this.getGroupCallMembers(conversationId));
      },
      onEnded: noop,
    });

    if (!outerGroupCall) {
      // This should be very rare, likely due to RingRTC not being able to get a lock
      //   or memory or something like that.
      throw new Error('Failed to get a group call instance; cannot start call');
    }

    outerGroupCall.connect();

    this.syncGroupCallToRedux(conversationId, outerGroupCall);

    return outerGroupCall;
  }

  public joinGroupCall(
    conversationId: string,
    hasLocalAudio: boolean,
    hasLocalVideo: boolean
  ): void {
    const conversation = window.ConversationController.get(
      conversationId
    )?.format();
    if (!conversation) {
      window.log.error('Missing conversation; not joining group call');
      return;
    }

    if (
      !conversation.groupId ||
      !conversation.publicParams ||
      !conversation.secretParams
    ) {
      window.log.error(
        'Conversation is missing required parameters. Cannot join group call'
      );
      return;
    }

    const groupCall = this.connectGroupCall(conversationId, {
      groupId: conversation.groupId,
      publicParams: conversation.publicParams,
      secretParams: conversation.secretParams,
    });

    groupCall.setOutgoingAudioMuted(!hasLocalAudio);
    groupCall.setOutgoingVideoMuted(!hasLocalVideo);
    this.videoCapturer.enableCaptureAndSend(groupCall);

    groupCall.join();
  }

  private getCallIdForConversation(conversationId: string): undefined | CallId {
    return this.getDirectCall(conversationId)?.callId;
  }

  public setGroupCallVideoRequest(
    conversationId: string,
    resolutions: Array<VideoRequest>
  ): void {
    this.getGroupCall(conversationId)?.requestVideo(resolutions);
  }

  public groupMembersChanged(conversationId: string): void {
    // This will be called for any conversation change, so it's likely that there won't
    //   be a group call available; that's fine.
    const groupCall = this.getGroupCall(conversationId);
    if (!groupCall) {
      return;
    }

    groupCall.setGroupMembers(this.getGroupCallMembers(conversationId));
  }

  // See the comment in types/Calling.ts to explain why we have to do this conversion.
  private convertRingRtcConnectionState(
    connectionState: ConnectionState
  ): GroupCallConnectionState {
    switch (connectionState) {
      case ConnectionState.NotConnected:
        return GroupCallConnectionState.NotConnected;
      case ConnectionState.Connecting:
        return GroupCallConnectionState.Connecting;
      case ConnectionState.Connected:
        return GroupCallConnectionState.Connected;
      case ConnectionState.Reconnecting:
        return GroupCallConnectionState.Reconnecting;
      default:
        throw missingCaseError(connectionState);
    }
  }

  // See the comment in types/Calling.ts to explain why we have to do this conversion.
  private convertRingRtcJoinState(joinState: JoinState): GroupCallJoinState {
    switch (joinState) {
      case JoinState.NotJoined:
        return GroupCallJoinState.NotJoined;
      case JoinState.Joining:
        return GroupCallJoinState.Joining;
      case JoinState.Joined:
        return GroupCallJoinState.Joined;
      default:
        throw missingCaseError(joinState);
    }
  }

  public formatGroupCallPeekInfoForRedux(
    peekInfo: PeekInfo
  ): GroupCallPeekInfoType {
    return {
      uuids: peekInfo.joinedMembers.map(uuidBuffer => {
        let uuid = arrayBufferToUuid(uuidBuffer);
        if (!uuid) {
          window.log.error(
            'Calling.formatGroupCallPeekInfoForRedux: could not convert peek UUID ArrayBuffer to string; using fallback UUID'
          );
          uuid = '00000000-0000-0000-0000-000000000000';
        }
        return uuid;
      }),
      creatorUuid: peekInfo.creator && arrayBufferToUuid(peekInfo.creator),
      eraId: peekInfo.eraId,
      maxDevices: peekInfo.maxDevices ?? Infinity,
      deviceCount: peekInfo.deviceCount,
    };
  }

  private formatGroupCallForRedux(groupCall: GroupCall) {
    const localDeviceState = groupCall.getLocalDeviceState();
    const peekInfo = groupCall.getPeekInfo();

    // RingRTC doesn't ensure that the demux ID is unique. This can happen if someone
    //   leaves the call and quickly rejoins; RingRTC will tell us that there are two
    //   participants with the same demux ID in the call. This should be rare.
    const remoteDeviceStates = uniqBy(
      groupCall.getRemoteDeviceStates() || [],
      remoteDeviceState => remoteDeviceState.demuxId
    );

    // It should be impossible to be disconnected and Joining or Joined. Just in case, we
    //   try to handle that case.
    const joinState: GroupCallJoinState =
      localDeviceState.connectionState === ConnectionState.NotConnected
        ? GroupCallJoinState.NotJoined
        : this.convertRingRtcJoinState(localDeviceState.joinState);

    return {
      connectionState: this.convertRingRtcConnectionState(
        localDeviceState.connectionState
      ),
      joinState,
      hasLocalAudio: !localDeviceState.audioMuted,
      hasLocalVideo: !localDeviceState.videoMuted,
      peekInfo: peekInfo
        ? this.formatGroupCallPeekInfoForRedux(peekInfo)
        : undefined,
      remoteParticipants: remoteDeviceStates.map(remoteDeviceState => {
        let uuid = arrayBufferToUuid(remoteDeviceState.userId);
        if (!uuid) {
          window.log.error(
            'Calling.formatGroupCallForRedux: could not convert remote participant UUID ArrayBuffer to string; using fallback UUID'
          );
          uuid = '00000000-0000-0000-0000-000000000000';
        }
        return {
          uuid,
          demuxId: remoteDeviceState.demuxId,
          hasRemoteAudio: !remoteDeviceState.audioMuted,
          hasRemoteVideo: !remoteDeviceState.videoMuted,
          speakerTime: normalizeGroupCallTimestamp(
            remoteDeviceState.speakerTime
          ),
          // If RingRTC doesn't send us an aspect ratio, we make a guess.
          videoAspectRatio:
            remoteDeviceState.videoAspectRatio ||
            (remoteDeviceState.videoMuted ? 1 : 4 / 3),
        };
      }),
    };
  }

  public getGroupCallVideoFrameSource(
    conversationId: string,
    demuxId: number
  ): VideoFrameSource {
    const groupCall = this.getGroupCall(conversationId);
    if (!groupCall) {
      throw new Error('Could not find matching call');
    }
    return groupCall.getVideoSource(demuxId);
  }

  public resendGroupCallMediaKeys(conversationId: string): void {
    const groupCall = this.getGroupCall(conversationId);
    if (!groupCall) {
      throw new Error('Could not find matching call');
    }
    groupCall.resendMediaKeys();
  }

  private syncGroupCallToRedux(
    conversationId: string,
    groupCall: GroupCall
  ): void {
    this.uxActions?.groupCallStateChange({
      conversationId,
      ...this.formatGroupCallForRedux(groupCall),
    });
  }

  private sendGroupCallUpdateMessage(
    conversationId: string,
    eraId: string
  ): void {
    const conversation = window.ConversationController.get(conversationId);
    if (!conversation) {
      window.log.error(
        'Unable to send group call update message for non-existent conversation'
      );
      return;
    }

    const groupV2 = conversation.getGroupV2Info();
    const sendOptions = conversation.getSendOptions();
    if (!groupV2) {
      window.log.error(
        'Unable to send group call update message for conversation that lacks groupV2 info'
      );
      return;
    }

    const timestamp = Date.now();

    // We "fire and forget" because sending this message is non-essential.
    wrapWithSyncMessageSend({
      conversation,
      logId: `sendGroupCallUpdateMessage/${conversationId}-${eraId}`,
      send: sender =>
        sender.sendGroupCallUpdate({ eraId, groupV2, timestamp }, sendOptions),
      timestamp,
    }).catch(err => {
      window.log.error('Failed to send group call update', err);
    });
  }

  async accept(conversationId: string, asVideoCall: boolean): Promise<void> {
    window.log.info('CallingClass.accept()');

    const callId = this.getCallIdForConversation(conversationId);
    if (!callId) {
      window.log.warn('Trying to accept a non-existent call');
      return;
    }

    const haveMediaPermissions = await this.requestPermissions(asVideoCall);
    if (haveMediaPermissions) {
      await this.startDeviceReselectionTimer();
      RingRTC.setVideoCapturer(callId, this.videoCapturer);
      RingRTC.setVideoRenderer(callId, this.videoRenderer);
      RingRTC.accept(callId, asVideoCall);
    } else {
      window.log.info('Permissions were denied, call not allowed, hanging up.');
      RingRTC.hangup(callId);
    }
  }

  decline(conversationId: string): void {
    window.log.info('CallingClass.decline()');

    const callId = this.getCallIdForConversation(conversationId);
    if (!callId) {
      window.log.warn('Trying to decline a non-existent call');
      return;
    }

    RingRTC.decline(callId);
  }

  hangup(conversationId: string): void {
    window.log.info('CallingClass.hangup()');

    const call = getOwn(this.callsByConversation, conversationId);
    if (!call) {
      window.log.warn('Trying to hang up a non-existent call');
      return;
    }

    if (call instanceof Call) {
      RingRTC.hangup(call.callId);
    } else if (call instanceof GroupCall) {
      // This ensures that we turn off our devices.
      call.setOutgoingAudioMuted(true);
      call.setOutgoingVideoMuted(true);
      call.disconnect();
    } else {
      throw missingCaseError(call);
    }
  }

  setOutgoingAudio(conversationId: string, enabled: boolean): void {
    const call = getOwn(this.callsByConversation, conversationId);
    if (!call) {
      window.log.warn('Trying to set outgoing audio for a non-existent call');
      return;
    }

    if (call instanceof Call) {
      RingRTC.setOutgoingAudio(call.callId, enabled);
    } else if (call instanceof GroupCall) {
      call.setOutgoingAudioMuted(!enabled);
    } else {
      throw missingCaseError(call);
    }
  }

  setOutgoingVideo(conversationId: string, enabled: boolean): void {
    const call = getOwn(this.callsByConversation, conversationId);
    if (!call) {
      window.log.warn('Trying to set outgoing video for a non-existent call');
      return;
    }

    if (call instanceof Call) {
      RingRTC.setOutgoingVideo(call.callId, enabled);
    } else if (call instanceof GroupCall) {
      call.setOutgoingVideoMuted(!enabled);
    } else {
      throw missingCaseError(call);
    }
  }

  private async startDeviceReselectionTimer(): Promise<void> {
    // Poll once
    await this.pollForMediaDevices();
    // Start the timer
    if (!this.deviceReselectionTimer) {
      this.deviceReselectionTimer = setInterval(async () => {
        await this.pollForMediaDevices();
      }, 3000);
    }
  }

  private stopDeviceReselectionTimer() {
    if (this.deviceReselectionTimer) {
      clearInterval(this.deviceReselectionTimer);
      this.deviceReselectionTimer = undefined;
    }
  }

  private mediaDeviceSettingsEqual(
    a?: MediaDeviceSettings,
    b?: MediaDeviceSettings
  ): boolean {
    if (!a && !b) {
      return true;
    }
    if (!a || !b) {
      return false;
    }
    if (
      a.availableCameras.length !== b.availableCameras.length ||
      a.availableMicrophones.length !== b.availableMicrophones.length ||
      a.availableSpeakers.length !== b.availableSpeakers.length
    ) {
      return false;
    }
    for (let i = 0; i < a.availableCameras.length; i += 1) {
      if (
        a.availableCameras[i].deviceId !== b.availableCameras[i].deviceId ||
        a.availableCameras[i].groupId !== b.availableCameras[i].groupId ||
        a.availableCameras[i].label !== b.availableCameras[i].label
      ) {
        return false;
      }
    }
    for (let i = 0; i < a.availableMicrophones.length; i += 1) {
      if (
        a.availableMicrophones[i].name !== b.availableMicrophones[i].name ||
        a.availableMicrophones[i].uniqueId !==
          b.availableMicrophones[i].uniqueId
      ) {
        return false;
      }
    }
    for (let i = 0; i < a.availableSpeakers.length; i += 1) {
      if (
        a.availableSpeakers[i].name !== b.availableSpeakers[i].name ||
        a.availableSpeakers[i].uniqueId !== b.availableSpeakers[i].uniqueId
      ) {
        return false;
      }
    }
    if (
      (a.selectedCamera && !b.selectedCamera) ||
      (!a.selectedCamera && b.selectedCamera) ||
      (a.selectedMicrophone && !b.selectedMicrophone) ||
      (!a.selectedMicrophone && b.selectedMicrophone) ||
      (a.selectedSpeaker && !b.selectedSpeaker) ||
      (!a.selectedSpeaker && b.selectedSpeaker)
    ) {
      return false;
    }
    if (
      a.selectedCamera &&
      b.selectedCamera &&
      a.selectedCamera !== b.selectedCamera
    ) {
      return false;
    }
    if (
      a.selectedMicrophone &&
      b.selectedMicrophone &&
      a.selectedMicrophone.index !== b.selectedMicrophone.index
    ) {
      return false;
    }
    if (
      a.selectedSpeaker &&
      b.selectedSpeaker &&
      a.selectedSpeaker.index !== b.selectedSpeaker.index
    ) {
      return false;
    }
    return true;
  }

  private async pollForMediaDevices(): Promise<void> {
    const newSettings = await this.getMediaDeviceSettings();
    if (
      !this.mediaDeviceSettingsEqual(this.lastMediaDeviceSettings, newSettings)
    ) {
      window.log.info(
        'MediaDevice: available devices changed (from->to)',
        this.lastMediaDeviceSettings,
        newSettings
      );

      await this.selectPreferredDevices(newSettings);
      this.lastMediaDeviceSettings = newSettings;
      this.uxActions?.refreshIODevices(newSettings);
    }
  }

  async getMediaDeviceSettings(): Promise<MediaDeviceSettings> {
    const availableMicrophones = RingRTC.getAudioInputs();
    const preferredMicrophone = window.storage.get(
      'preferred-audio-input-device'
    );
    const selectedMicIndex = this.findBestMatchingDeviceIndex(
      availableMicrophones,
      preferredMicrophone
    );
    const selectedMicrophone =
      selectedMicIndex !== undefined
        ? availableMicrophones[selectedMicIndex]
        : undefined;

    const availableSpeakers = RingRTC.getAudioOutputs();
    const preferredSpeaker = window.storage.get(
      'preferred-audio-output-device'
    );
    const selectedSpeakerIndex = this.findBestMatchingDeviceIndex(
      availableSpeakers,
      preferredSpeaker
    );
    const selectedSpeaker =
      selectedSpeakerIndex !== undefined
        ? availableSpeakers[selectedSpeakerIndex]
        : undefined;

    const availableCameras = await this.videoCapturer.enumerateDevices();
    const preferredCamera = window.storage.get('preferred-video-input-device');
    const selectedCamera = this.findBestMatchingCamera(
      availableCameras,
      preferredCamera
    );

    return {
      availableMicrophones,
      availableSpeakers,
      selectedMicrophone,
      selectedSpeaker,
      availableCameras,
      selectedCamera,
    };
  }

  findBestMatchingDeviceIndex(
    available: Array<AudioDevice>,
    preferred: AudioDevice | undefined
  ): number | undefined {
    if (preferred) {
      // Match by uniqueId first, if available
      if (preferred.uniqueId) {
        const matchIndex = available.findIndex(
          d => d.uniqueId === preferred.uniqueId
        );
        if (matchIndex !== -1) {
          return matchIndex;
        }
      }
      // Match by name second
      const matchingNames = available.filter(d => d.name === preferred.name);
      if (matchingNames.length > 0) {
        return matchingNames[0].index;
      }
    }
    // Nothing matches or no preference; take the first device if there are any
    return available.length > 0 ? 0 : undefined;
  }

  findBestMatchingCamera(
    available: Array<MediaDeviceInfo>,
    preferred?: string
  ): string | undefined {
    const matchingId = available.filter(d => d.deviceId === preferred);
    const nonInfrared = available.filter(d => !d.label.includes('IR Camera'));

    // By default, pick the first non-IR camera (but allow the user to pick the
    // infrared if they so desire)
    if (matchingId.length > 0) {
      return matchingId[0].deviceId;
    }
    if (nonInfrared.length > 0) {
      return nonInfrared[0].deviceId;
    }

    return undefined;
  }

  setPreferredMicrophone(device: AudioDevice): void {
    window.log.info('MediaDevice: setPreferredMicrophone', device);
    window.storage.put('preferred-audio-input-device', device);
    RingRTC.setAudioInput(device.index);
  }

  setPreferredSpeaker(device: AudioDevice): void {
    window.log.info('MediaDevice: setPreferredSpeaker', device);
    window.storage.put('preferred-audio-output-device', device);
    RingRTC.setAudioOutput(device.index);
  }

  enableLocalCamera(): void {
    this.videoCapturer.enableCapture();
  }

  disableLocalCamera(): void {
    this.videoCapturer.disable();
  }

  async setPreferredCamera(device: string): Promise<void> {
    window.log.info('MediaDevice: setPreferredCamera', device);
    window.storage.put('preferred-video-input-device', device);
    await this.videoCapturer.setPreferredDevice(device);
  }

  async handleCallingMessage(
    envelope: EnvelopeClass,
    callingMessage: CallingMessage
  ): Promise<void> {
    window.log.info('CallingClass.handleCallingMessage()');

    const enableIncomingCalls = await window.getIncomingCallNotification();
    if (callingMessage.offer && !enableIncomingCalls) {
      // Drop offers silently if incoming call notifications are disabled.
      window.log.info('Incoming calls are disabled, ignoring call offer.');
      return;
    }

    const remoteUserId = envelope.sourceUuid || envelope.source;
    const remoteDeviceId = this.parseDeviceId(envelope.sourceDevice);
    if (!remoteUserId || !remoteDeviceId || !this.localDeviceId) {
      window.log.error('Missing identifier, ignoring call message.');
      return;
    }

    const senderIdentityRecord = window.textsecure.storage.protocol.getIdentityRecord(
      remoteUserId
    );
    if (!senderIdentityRecord) {
      window.log.error(
        'Missing sender identity record; ignoring call message.'
      );
      return;
    }
    const senderIdentityKey = senderIdentityRecord.publicKey.slice(1); // Ignore the type header, it is not used.

    const receiverIdentityRecord = window.textsecure.storage.protocol.getIdentityRecord(
      window.textsecure.storage.user.getUuid() ||
        window.textsecure.storage.user.getNumber()
    );
    if (!receiverIdentityRecord) {
      window.log.error(
        'Missing receiver identity record; ignoring call message.'
      );
      return;
    }
    const receiverIdentityKey = receiverIdentityRecord.publicKey.slice(1); // Ignore the type header, it is not used.

    const conversation = window.ConversationController.get(remoteUserId);
    if (!conversation) {
      window.log.error('Missing conversation; ignoring call message.');
      return;
    }

    if (callingMessage.offer && !conversation.getAccepted()) {
      window.log.info(
        'Conversation was not approved by user; rejecting call message.'
      );

      const hangup = new HangupMessage();
      hangup.callId = callingMessage.offer.callId;
      hangup.deviceId = remoteDeviceId;
      hangup.type = HangupType.NeedPermission;

      const message = new CallingMessage();
      message.legacyHangup = hangup;

      await this.handleOutgoingSignaling(remoteUserId, message);

      this.addCallHistoryForFailedIncomingCall(
        conversation,
        callingMessage.offer.type === OfferType.VideoCall
      );

      return;
    }

    const sourceUuid = envelope.sourceUuid
      ? uuidToArrayBuffer(envelope.sourceUuid)
      : null;

    const messageAgeSec = envelope.messageAgeSec ? envelope.messageAgeSec : 0;

    window.log.info('CallingClass.handleCallingMessage(): Handling in RingRTC');

    RingRTC.handleCallingMessage(
      remoteUserId,
      sourceUuid,
      remoteDeviceId,
      this.localDeviceId,
      messageAgeSec,
      callingMessage,
      senderIdentityKey,
      receiverIdentityKey
    );
  }

  private async selectPreferredDevices(
    settings: MediaDeviceSettings
  ): Promise<void> {
    if (
      (!this.lastMediaDeviceSettings && settings.selectedCamera) ||
      (this.lastMediaDeviceSettings &&
        settings.selectedCamera &&
        this.lastMediaDeviceSettings.selectedCamera !== settings.selectedCamera)
    ) {
      window.log.info('MediaDevice: selecting camera', settings.selectedCamera);
      await this.videoCapturer.setPreferredDevice(settings.selectedCamera);
    }

    // Assume that the MediaDeviceSettings have been obtained very recently and
    // the index is still valid (no devices have been plugged in in between).
    if (settings.selectedMicrophone) {
      window.log.info(
        'MediaDevice: selecting microphone',
        settings.selectedMicrophone
      );
      RingRTC.setAudioInput(settings.selectedMicrophone.index);
    }

    if (settings.selectedSpeaker) {
      window.log.info(
        'MediaDevice: selecting speaker',
        settings.selectedSpeaker
      );
      RingRTC.setAudioOutput(settings.selectedSpeaker.index);
    }
  }

  private async requestCameraPermissions(): Promise<boolean> {
    const cameraPermission = await window.getMediaCameraPermissions();
    if (!cameraPermission) {
      await window.showCallingPermissionsPopup(true);

      // Check the setting again (from the source of truth).
      return window.getMediaCameraPermissions();
    }

    return true;
  }

  private async requestMicrophonePermissions(): Promise<boolean> {
    const microphonePermission = await window.getMediaPermissions();
    if (!microphonePermission) {
      await window.showCallingPermissionsPopup(false);

      // Check the setting again (from the source of truth).
      return window.getMediaPermissions();
    }

    return true;
  }

  private async requestPermissions(isVideoCall: boolean): Promise<boolean> {
    const microphonePermission = await this.requestMicrophonePermissions();
    if (microphonePermission) {
      if (isVideoCall) {
        return this.requestCameraPermissions();
      }

      return true;
    }

    return false;
  }

  private async handleSendCallMessage(
    recipient: ArrayBuffer,
    data: ArrayBuffer
  ): Promise<boolean> {
    const userId = arrayBufferToUuid(recipient);
    if (!userId) {
      window.log.error('handleSendCallMessage(): bad recipient UUID');
      return false;
    }
    const message = new CallingMessage();
    message.opaque = new OpaqueMessage();
    message.opaque.data = data;
    return this.handleOutgoingSignaling(userId, message);
  }

  private async handleOutgoingSignaling(
    remoteUserId: UserId,
    message: CallingMessage
  ): Promise<boolean> {
    const conversation = window.ConversationController.get(remoteUserId);
    const sendOptions = conversation
      ? conversation.getSendOptions()
      : undefined;

    if (!window.textsecure.messaging) {
      window.log.warn('handleOutgoingSignaling() returning false; offline');
      return false;
    }

    try {
      await window.textsecure.messaging.sendCallingMessage(
        remoteUserId,
        message,
        sendOptions
      );

      window.log.info('handleOutgoingSignaling() completed successfully');
      return true;
    } catch (err) {
      if (err && err.errors && err.errors.length > 0) {
        window.log.error(
          `handleOutgoingSignaling() failed: ${err.errors[0].reason}`
        );
      } else {
        window.log.error('handleOutgoingSignaling() failed');
      }
      return false;
    }
  }

  // If we return null here, we hang up the call.
  private async handleIncomingCall(call: Call): Promise<CallSettings | null> {
    window.log.info('CallingClass.handleIncomingCall()');

    if (!this.uxActions || !this.localDeviceId) {
      window.log.error('Missing required objects, ignoring incoming call.');
      return null;
    }

    const conversation = window.ConversationController.get(call.remoteUserId);
    if (!conversation) {
      window.log.error('Missing conversation, ignoring incoming call.');
      return null;
    }

    try {
      // The peer must be 'trusted' before accepting a call from them.
      // This is mostly the safety number check, unverified meaning that they were
      // verified before but now they are not.
      const verifiedEnum = await conversation.safeGetVerified();
      if (
        verifiedEnum ===
        window.textsecure.storage.protocol.VerifiedStatus.UNVERIFIED
      ) {
        window.log.info(
          `Peer is not trusted, ignoring incoming call for conversation: ${conversation.idForLogging()}`
        );
        this.addCallHistoryForFailedIncomingCall(
          conversation,
          call.isVideoCall
        );
        return null;
      }

      this.attachToCall(conversation, call);

      this.uxActions.receiveIncomingCall({
        conversationId: conversation.id,
        isVideoCall: call.isVideoCall,
      });

      window.log.info('CallingClass.handleIncomingCall(): Proceeding');

      return await this.getCallSettings(conversation);
    } catch (err) {
      window.log.error(`Ignoring incoming call: ${err.stack}`);
      this.addCallHistoryForFailedIncomingCall(conversation, call.isVideoCall);
      return null;
    }
  }

  private handleAutoEndedIncomingCallRequest(
    remoteUserId: UserId,
    reason: CallEndedReason
  ) {
    const conversation = window.ConversationController.get(remoteUserId);
    if (!conversation) {
      return;
    }
    this.addCallHistoryForAutoEndedIncomingCall(conversation, reason);
  }

  private attachToCall(conversation: ConversationModel, call: Call): void {
    this.callsByConversation[conversation.id] = call;

    const { uxActions } = this;
    if (!uxActions) {
      return;
    }

    let acceptedTime: number | undefined;

    // eslint-disable-next-line no-param-reassign
    call.handleStateChanged = () => {
      if (call.state === CallState.Accepted) {
        acceptedTime = acceptedTime || Date.now();
      } else if (call.state === CallState.Ended) {
        this.addCallHistoryForEndedCall(conversation, call, acceptedTime);
        this.stopDeviceReselectionTimer();
        this.lastMediaDeviceSettings = undefined;
        delete this.callsByConversation[conversation.id];
      }
      uxActions.callStateChange({
        conversationId: conversation.id,
        acceptedTime,
        callState: call.state,
        callEndedReason: call.endedReason,
        isIncoming: call.isIncoming,
        isVideoCall: call.isVideoCall,
        title: conversation.getTitle(),
      });
    };

    // eslint-disable-next-line no-param-reassign
    call.handleRemoteVideoEnabled = () => {
      uxActions.remoteVideoChange({
        conversationId: conversation.id,
        hasVideo: call.remoteVideoEnabled,
      });
    };
  }

  private async handleLogMessage(
    level: CallLogLevel,
    fileName: string,
    line: number,
    message: string
  ) {
    switch (level) {
      case CallLogLevel.Info:
        window.log.info(`${fileName}:${line} ${message}`);
        break;
      case CallLogLevel.Warn:
        window.log.warn(`${fileName}:${line} ${message}`);
        break;
      case CallLogLevel.Error:
        window.log.error(`${fileName}:${line} ${message}`);
        break;
      default:
        break;
    }
  }

  private async handleSendHttpRequest(
    requestId: number,
    url: string,
    method: HttpMethod,
    headers: { [name: string]: string },
    body: ArrayBuffer | undefined
  ) {
    if (!window.textsecure.messaging) {
      RingRTC.httpRequestFailed(requestId, 'We are offline');
      return;
    }

    const httpMethod = RINGRTC_HTTP_METHOD_TO_OUR_HTTP_METHOD.get(method);
    if (httpMethod === undefined) {
      RingRTC.httpRequestFailed(
        requestId,
        `Unknown method: ${JSON.stringify(method)}`
      );
      return;
    }

    let result;
    try {
      result = await window.textsecure.messaging.server.makeSfuRequest(
        url,
        httpMethod,
        headers,
        body
      );
    } catch (err) {
      if (err.code !== -1) {
        // WebAPI treats certain response codes as errors, but RingRTC still needs to
        // see them. It does not currently look at the response body, so we're giving
        // it an empty one.
        RingRTC.receivedHttpResponse(requestId, err.code, new ArrayBuffer(0));
      } else {
        window.log.error('handleSendHttpRequest: fetch failed with error', err);
        RingRTC.httpRequestFailed(requestId, String(err));
      }
      return;
    }

    RingRTC.receivedHttpResponse(
      requestId,
      result.response.status,
      result.data
    );
  }

  private getRemoteUserIdFromConversation(
    conversation: ConversationModel
  ): UserId | undefined | null {
    const recipients = conversation.getRecipients();
    if (recipients.length !== 1) {
      return undefined;
    }
    return recipients[0];
  }

  private get localDeviceId(): DeviceId | null {
    return this.parseDeviceId(window.textsecure.storage.user.getDeviceId());
  }

  private parseDeviceId(
    deviceId: number | string | undefined
  ): DeviceId | null {
    if (typeof deviceId === 'string') {
      return parseInt(deviceId, 10);
    }
    if (typeof deviceId === 'number') {
      return deviceId;
    }
    return null;
  }

  private async getCallSettings(
    conversation: ConversationModel
  ): Promise<CallSettings> {
    if (!window.textsecure.messaging) {
      throw new Error('getCallSettings: offline!');
    }

    const iceServerJson = await window.textsecure.messaging.server.getIceServers();

    const shouldRelayCalls = Boolean(await window.getAlwaysRelayCalls());

    // If the peer is 'unknown', i.e. not in the contact list, force IP hiding.
    const isContactUnknown = !conversation.isFromOrAddedByTrustedContact();

    return {
      iceServer: JSON.parse(iceServerJson),
      hideIp: shouldRelayCalls || isContactUnknown,
      bandwidthMode: BandwidthMode.Normal,
    };
  }

  private addCallHistoryForEndedCall(
    conversation: ConversationModel,
    call: Call,
    acceptedTimeParam: number | undefined
  ) {
    let acceptedTime = acceptedTimeParam;

    const { endedReason, isIncoming } = call;
    const wasAccepted = Boolean(acceptedTime);
    const isOutgoing = !isIncoming;
    const wasDeclined =
      !wasAccepted &&
      (endedReason === CallEndedReason.Declined ||
        endedReason === CallEndedReason.DeclinedOnAnotherDevice ||
        (isIncoming && endedReason === CallEndedReason.LocalHangup) ||
        (isOutgoing && endedReason === CallEndedReason.RemoteHangup) ||
        (isOutgoing &&
          endedReason === CallEndedReason.RemoteHangupNeedPermission));
    if (call.endedReason === CallEndedReason.AcceptedOnAnotherDevice) {
      acceptedTime = Date.now();
    }

    conversation.addCallHistory({
      callMode: CallMode.Direct,
      wasIncoming: call.isIncoming,
      wasVideoCall: call.isVideoCall,
      wasDeclined,
      acceptedTime,
      endedTime: Date.now(),
    });
  }

  private addCallHistoryForFailedIncomingCall(
    conversation: ConversationModel,
    wasVideoCall: boolean
  ) {
    conversation.addCallHistory({
      callMode: CallMode.Direct,
      wasIncoming: true,
      wasVideoCall,
      // Since the user didn't decline, make sure it shows up as a missed call instead
      wasDeclined: false,
      acceptedTime: undefined,
      endedTime: Date.now(),
    });
  }

  private addCallHistoryForAutoEndedIncomingCall(
    conversation: ConversationModel,
    _reason: CallEndedReason
  ) {
    conversation.addCallHistory({
      callMode: CallMode.Direct,
      wasIncoming: true,
      // We don't actually know, but it doesn't seem that important in this case,
      // but we could maybe plumb this info through RingRTC
      wasVideoCall: false,
      // Since the user didn't decline, make sure it shows up as a missed call instead
      wasDeclined: false,
      acceptedTime: undefined,
      endedTime: Date.now(),
    });
  }

  public updateCallHistoryForGroupCall(
    conversationId: string,
    peekInfo: undefined | PeekInfo
  ): void {
    // If we don't have the necessary pieces to peek, bail. (It's okay if we don't.)
    if (!peekInfo || !peekInfo.eraId || !peekInfo.creator) {
      return;
    }
    const creatorUuid = arrayBufferToUuid(peekInfo.creator);
    if (!creatorUuid) {
      window.log.error('updateCallHistoryForGroupCall(): bad creator UUID');
      return;
    }

    const conversation = window.ConversationController.get(conversationId);
    if (!conversation) {
      window.log.error(
        'updateCallHistoryForGroupCall(): could not find conversation'
      );
      return;
    }

    conversation.updateCallHistoryForGroupCall(peekInfo.eraId, creatorUuid);
  }
}

export const calling = new CallingClass();
