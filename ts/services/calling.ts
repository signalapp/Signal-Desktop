// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { DesktopCapturerSource } from 'electron';
import { ipcRenderer } from 'electron';
import type {
  AudioDevice,
  CallId,
  CallMessageUrgency,
  CallSettings,
  DeviceId,
  PeekInfo,
  UserId,
  VideoFrameSource,
  VideoRequest,
} from 'ringrtc';
import {
  Call,
  CallEndedReason,
  CallingMessage,
  CallLogLevel,
  CallState,
  CanvasVideoRenderer,
  ConnectionState,
  JoinState,
  HttpMethod,
  GroupCall,
  GroupMemberInfo,
  GumVideoCapturer,
  HangupMessage,
  HangupType,
  OpaqueMessage,
  RingCancelReason,
  RingRTC,
  RingUpdate,
  BandwidthMode,
} from 'ringrtc';
import { uniqBy, noop } from 'lodash';

import type {
  ActionsType as UxActionsType,
  GroupCallParticipantInfoType,
  GroupCallPeekInfoType,
} from '../state/ducks/calling';
import type { ConversationType } from '../state/ducks/conversations';
import { getConversationCallMode } from '../state/ducks/conversations';
import { isMe } from '../util/whatTypeOfConversation';
import type {
  AvailableIODevicesType,
  MediaDeviceSettings,
  PresentableSource,
  PresentedSource,
} from '../types/Calling';
import {
  CallMode,
  GroupCallConnectionState,
  GroupCallJoinState,
  ProcessGroupCallRingRequestResult,
} from '../types/Calling';
import {
  AudioDeviceModule,
  getAudioDeviceModule,
  parseAudioDeviceModule,
} from '../calling/audioDeviceModule';
import {
  findBestMatchingAudioDeviceIndex,
  findBestMatchingCameraId,
} from '../calling/findBestMatchingDevice';
import type { LocalizerType } from '../types/Util';
import { UUID } from '../types/UUID';
import type { ConversationModel } from '../models/conversations';
import * as Bytes from '../Bytes';
import { uuidToBytes, bytesToUuid } from '../Crypto';
import { dropNull, shallowDropNull } from '../util/dropNull';
import { getOwn } from '../util/getOwn';
import { isNormalNumber } from '../util/isNormalNumber';
import * as durations from '../util/durations';
import { clearTimeoutIfNecessary } from '../util/clearTimeoutIfNecessary';
import { handleMessageSend } from '../util/handleMessageSend';
import { fetchMembershipProof, getMembershipList } from '../groups';
import { wrapWithSyncMessageSend } from '../util/wrapWithSyncMessageSend';
import type { ProcessedEnvelope } from '../textsecure/Types.d';
import { missingCaseError } from '../util/missingCaseError';
import { normalizeGroupCallTimestamp } from '../util/ringrtc/normalizeGroupCallTimestamp';
import {
  AUDIO_LEVEL_INTERVAL_MS,
  REQUESTED_VIDEO_WIDTH,
  REQUESTED_VIDEO_HEIGHT,
  REQUESTED_VIDEO_FRAMERATE,
} from '../calling/constants';
import { callingMessageToProto } from '../util/callingMessageToProto';
import { getSendOptions } from '../util/getSendOptions';
import { requestMicrophonePermissions } from '../util/requestMicrophonePermissions';
import { SignalService as Proto } from '../protobuf';
import dataInterface from '../sql/Client';
import {
  notificationService,
  NotificationSetting,
  FALLBACK_NOTIFICATION_TITLE,
} from './notifications';
import * as log from '../logging/log';
import { assert } from '../util/assert';

const {
  processGroupCallRingRequest,
  processGroupCallRingCancelation,
  cleanExpiredGroupCallRings,
} = dataInterface;

const RINGRTC_HTTP_METHOD_TO_OUR_HTTP_METHOD: Map<
  HttpMethod,
  'GET' | 'PUT' | 'POST' | 'DELETE'
> = new Map([
  [HttpMethod.Get, 'GET'],
  [HttpMethod.Put, 'PUT'],
  [HttpMethod.Post, 'POST'],
  [HttpMethod.Delete, 'DELETE'],
]);

const CLEAN_EXPIRED_GROUP_CALL_RINGS_INTERVAL = 10 * durations.MINUTE;

// We send group call update messages to tell other clients to peek, which triggers
//   notifications, timeline messages, big green "Join" buttons, and so on. This enum
//   represents the three possible states we can be in. This helps ensure that we don't
//   send an update on disconnect if we never sent one when we joined.
enum GroupCallUpdateMessageState {
  SentNothing,
  SentJoin,
  SentLeft,
}

function isScreenSource(source: PresentedSource): boolean {
  return source.id.startsWith('screen');
}

function translateSourceName(
  i18n: LocalizerType,
  source: PresentedSource
): string {
  const { name } = source;
  if (!isScreenSource(source)) {
    return name;
  }

  if (name === 'Entire Screen') {
    return i18n('calling__SelectPresentingSourcesModal--entireScreen');
  }

  const match = name.match(/^Screen (\d+)$/);
  if (match) {
    return i18n('calling__SelectPresentingSourcesModal--screen', {
      id: match[1],
    });
  }

  return name;
}

function protoToCallingMessage({
  offer,
  answer,
  iceCandidates,
  legacyHangup,
  busy,
  hangup,
  supportsMultiRing,
  destinationDeviceId,
  opaque,
}: Proto.ICallingMessage): CallingMessage {
  return {
    offer: offer
      ? {
          ...shallowDropNull(offer),

          type: dropNull(offer.type) as number,
          opaque: offer.opaque ? Buffer.from(offer.opaque) : undefined,
        }
      : undefined,
    answer: answer
      ? {
          ...shallowDropNull(answer),
          opaque: answer.opaque ? Buffer.from(answer.opaque) : undefined,
        }
      : undefined,
    iceCandidates: iceCandidates
      ? iceCandidates.map(candidate => {
          return {
            ...shallowDropNull(candidate),
            opaque: candidate.opaque
              ? Buffer.from(candidate.opaque)
              : undefined,
          };
        })
      : undefined,
    legacyHangup: legacyHangup
      ? {
          ...shallowDropNull(legacyHangup),
          type: dropNull(legacyHangup.type) as number,
        }
      : undefined,
    busy: shallowDropNull(busy),
    hangup: hangup
      ? {
          ...shallowDropNull(hangup),
          type: dropNull(hangup.type) as number,
        }
      : undefined,
    supportsMultiRing: dropNull(supportsMultiRing),
    destinationDeviceId: dropNull(destinationDeviceId),
    opaque: opaque
      ? {
          data: opaque.data ? Buffer.from(opaque.data) : undefined,
        }
      : undefined,
  };
}

export class CallingClass {
  readonly videoCapturer: GumVideoCapturer;

  readonly videoRenderer: CanvasVideoRenderer;

  private uxActions?: UxActionsType;

  private sfuUrl?: string;

  private lastMediaDeviceSettings?: MediaDeviceSettings;

  private previousAudioDeviceModule?: AudioDeviceModule;

  private currentAudioDeviceModule?: AudioDeviceModule;

  private deviceReselectionTimer?: NodeJS.Timeout;

  private callsByConversation: { [conversationId: string]: Call | GroupCall };

  private hadLocalVideoBeforePresenting?: boolean;

  constructor() {
    this.videoCapturer = new GumVideoCapturer({
      maxWidth: REQUESTED_VIDEO_WIDTH,
      maxHeight: REQUESTED_VIDEO_HEIGHT,
      maxFramerate: REQUESTED_VIDEO_FRAMERATE,
    });
    this.videoRenderer = new CanvasVideoRenderer();

    this.callsByConversation = {};
  }

  initialize(uxActions: UxActionsType, sfuUrl: string): void {
    this.uxActions = uxActions;
    if (!uxActions) {
      throw new Error('CallingClass.initialize: Invalid uxActions.');
    }

    this.sfuUrl = sfuUrl;

    this.previousAudioDeviceModule = parseAudioDeviceModule(
      window.storage.get('previousAudioDeviceModule')
    );
    this.currentAudioDeviceModule = getAudioDeviceModule();
    window.storage.put(
      'previousAudioDeviceModule',
      this.currentAudioDeviceModule
    );

    RingRTC.setConfig({
      use_new_audio_device_module:
        this.currentAudioDeviceModule === AudioDeviceModule.WindowsAdm2,
    });

    RingRTC.handleOutgoingSignaling = this.handleOutgoingSignaling.bind(this);
    RingRTC.handleIncomingCall = this.handleIncomingCall.bind(this);
    RingRTC.handleAutoEndedIncomingCallRequest =
      this.handleAutoEndedIncomingCallRequest.bind(this);
    RingRTC.handleLogMessage = this.handleLogMessage.bind(this);
    RingRTC.handleSendHttpRequest = this.handleSendHttpRequest.bind(this);
    RingRTC.handleSendCallMessage = this.handleSendCallMessage.bind(this);
    RingRTC.handleSendCallMessageToGroup =
      this.handleSendCallMessageToGroup.bind(this);
    RingRTC.handleGroupCallRingUpdate =
      this.handleGroupCallRingUpdate.bind(this);

    this.attemptToGiveOurUuidToRingRtc();
    window.Whisper.events.on('userChanged', () => {
      this.attemptToGiveOurUuidToRingRtc();
    });

    ipcRenderer.on('stop-screen-share', () => {
      uxActions.setPresenting();
    });

    ipcRenderer.on('quit', () => {
      for (const conversationId of Object.keys(this.callsByConversation)) {
        this.hangup(conversationId);
      }
    });

    this.cleanExpiredGroupCallRingsAndLoop();
  }

  private attemptToGiveOurUuidToRingRtc(): void {
    const ourUuid = window.textsecure.storage.user.getUuid()?.toString();
    if (!ourUuid) {
      // This can happen if we're not linked. It's okay if we hit this case.
      return;
    }

    RingRTC.setSelfUuid(Buffer.from(uuidToBytes(ourUuid)));
  }

  async startCallingLobby({
    conversation,
    hasLocalAudio,
    hasLocalVideo,
  }: Readonly<{
    conversation: Readonly<ConversationType>;
    hasLocalAudio: boolean;
    hasLocalVideo: boolean;
  }>): Promise<
    | undefined
    | ({ hasLocalAudio: boolean; hasLocalVideo: boolean } & (
        | { callMode: CallMode.Direct }
        | {
            callMode: CallMode.Group;
            connectionState: GroupCallConnectionState;
            joinState: GroupCallJoinState;
            peekInfo?: GroupCallPeekInfoType;
            remoteParticipants: Array<GroupCallParticipantInfoType>;
          }
      ))
  > {
    log.info('CallingClass.startCallingLobby()');

    const callMode = getConversationCallMode(conversation);
    switch (callMode) {
      case CallMode.None:
        log.error('Conversation does not support calls, new call not allowed.');
        return;
      case CallMode.Direct: {
        const conversationModel = window.ConversationController.get(
          conversation.id
        );
        if (
          !conversationModel ||
          !this.getRemoteUserIdFromConversation(conversationModel)
        ) {
          log.error('Missing remote user identifier, new call not allowed.');
          return;
        }
        break;
      }
      case CallMode.Group:
        break;
      default:
        throw missingCaseError(callMode);
    }

    if (!this.uxActions) {
      log.error('Missing uxActions, new call not allowed.');
      return;
    }

    if (!this.localDeviceId) {
      log.error('Missing local device identifier, new call not allowed.');
      return;
    }

    const haveMediaPermissions = await this.requestPermissions(hasLocalVideo);
    if (!haveMediaPermissions) {
      log.info('Permissions were denied, new call not allowed.');
      return;
    }

    log.info('CallingClass.startCallingLobby(): Starting lobby');

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

    const enableLocalCameraIfNecessary = hasLocalVideo
      ? () => this.enableLocalCamera()
      : noop;

    switch (callMode) {
      case CallMode.Direct:
        // We could easily support this in the future if we need to.
        assert(
          hasLocalAudio,
          'Expected local audio to be enabled for direct call lobbies'
        );
        enableLocalCameraIfNecessary();
        return {
          callMode: CallMode.Direct,
          hasLocalAudio,
          hasLocalVideo,
        };
      case CallMode.Group: {
        if (
          !conversation.groupId ||
          !conversation.publicParams ||
          !conversation.secretParams
        ) {
          log.error(
            'Conversation is missing required parameters. Cannot connect group call'
          );
          return;
        }
        const groupCall = this.connectGroupCall(conversation.id, {
          groupId: conversation.groupId,
          publicParams: conversation.publicParams,
          secretParams: conversation.secretParams,
        });

        groupCall.setOutgoingAudioMuted(!hasLocalAudio);
        groupCall.setOutgoingVideoMuted(!hasLocalVideo);

        enableLocalCameraIfNecessary();

        return {
          callMode: CallMode.Group,
          ...this.formatGroupCallForRedux(groupCall),
        };
      }
      default:
        throw missingCaseError(callMode);
    }
  }

  stopCallingLobby(conversationId?: string): void {
    this.disableLocalVideo();
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
    log.info('CallingClass.startOutgoingDirectCall()');

    if (!this.uxActions) {
      throw new Error('Redux actions not available');
    }

    const conversation = window.ConversationController.get(conversationId);
    if (!conversation) {
      log.error('Could not find conversation, cannot start call');
      this.stopCallingLobby();
      return;
    }

    const remoteUserId = this.getRemoteUserIdFromConversation(conversation);
    if (!remoteUserId || !this.localDeviceId) {
      log.error('Missing identifier, new call not allowed.');
      this.stopCallingLobby();
      return;
    }

    const haveMediaPermissions = await this.requestPermissions(hasLocalVideo);
    if (!haveMediaPermissions) {
      log.info('Permissions were denied, new call not allowed.');
      this.stopCallingLobby();
      return;
    }

    log.info('CallingClass.startOutgoingDirectCall(): Getting call settings');

    const callSettings = await this.getCallSettings(conversation);

    // Check state after awaiting to debounce call button.
    if (RingRTC.call && RingRTC.call.state !== CallState.Ended) {
      log.info('Call already in progress, new call not allowed.');
      this.stopCallingLobby();
      return;
    }

    log.info('CallingClass.startOutgoingDirectCall(): Starting in RingRTC');

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
          Buffer.from(uuidToBytes(member.uuid)),
          Buffer.from(member.uuidCiphertext)
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
    const membershipProof = Bytes.fromString(proof);

    return RingRTC.peekGroupCall(
      this.sfuUrl,
      Buffer.from(membershipProof),
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

    const groupIdBuffer = Buffer.from(Bytes.fromBase64(groupId));

    let updateMessageState = GroupCallUpdateMessageState.SentNothing;
    let isRequestingMembershipProof = false;

    const outerGroupCall = RingRTC.getGroupCall(
      groupIdBuffer,
      this.sfuUrl,
      Buffer.alloc(0),
      AUDIO_LEVEL_INTERVAL_MS,
      {
        onLocalDeviceStateChanged: groupCall => {
          const localDeviceState = groupCall.getLocalDeviceState();
          const { eraId } = groupCall.getPeekInfo() || {};

          if (
            localDeviceState.connectionState === ConnectionState.NotConnected
          ) {
            // NOTE: This assumes that only one call is active at a time. For example, if
            //   there are two calls using the camera, this will disable both of them.
            //   That's fine for now, but this will break if that assumption changes.
            this.disableLocalVideo();

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
              this.disableLocalVideo();
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
        onAudioLevels: groupCall => {
          const remoteDeviceStates = groupCall.getRemoteDeviceStates();
          if (!remoteDeviceStates) {
            return;
          }
          const localAudioLevel = groupCall.getLocalDeviceState().audioLevel;

          this.uxActions?.groupCallAudioLevelsChange({
            conversationId,
            localAudioLevel,
            remoteDeviceStates,
          });
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
              groupCall.setMembershipProof(
                Buffer.from(Bytes.fromString(proof))
              );
            }
          } catch (err) {
            log.error('Failed to fetch membership proof', err);
          } finally {
            isRequestingMembershipProof = false;
          }
        },
        requestGroupMembers: groupCall => {
          groupCall.setGroupMembers(this.getGroupCallMembers(conversationId));
        },
        onEnded: noop,
      }
    );

    if (!outerGroupCall) {
      // This should be very rare, likely due to RingRTC not being able to get a lock
      //   or memory or something like that.
      throw new Error('Failed to get a group call instance; cannot start call');
    }

    outerGroupCall.connect();

    this.syncGroupCallToRedux(conversationId, outerGroupCall);

    return outerGroupCall;
  }

  public async joinGroupCall(
    conversationId: string,
    hasLocalAudio: boolean,
    hasLocalVideo: boolean,
    shouldRing: boolean
  ): Promise<void> {
    const conversation =
      window.ConversationController.get(conversationId)?.format();
    if (!conversation) {
      log.error('Missing conversation; not joining group call');
      return;
    }

    if (
      !conversation.groupId ||
      !conversation.publicParams ||
      !conversation.secretParams
    ) {
      log.error(
        'Conversation is missing required parameters. Cannot join group call'
      );
      return;
    }

    await this.startDeviceReselectionTimer();

    const groupCall = this.connectGroupCall(conversationId, {
      groupId: conversation.groupId,
      publicParams: conversation.publicParams,
      secretParams: conversation.secretParams,
    });

    groupCall.setOutgoingAudioMuted(!hasLocalAudio);
    groupCall.setOutgoingVideoMuted(!hasLocalVideo);
    this.videoCapturer.enableCaptureAndSend(groupCall);

    if (shouldRing) {
      groupCall.ringAll();
    }

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
      uuids: peekInfo.devices.map(peekDeviceInfo => {
        if (peekDeviceInfo.userId) {
          const uuid = bytesToUuid(peekDeviceInfo.userId);
          if (uuid) {
            return uuid;
          }
          log.error(
            'Calling.formatGroupCallPeekInfoForRedux: could not convert peek UUID Uint8Array to string; using fallback UUID'
          );
        } else {
          log.error(
            'Calling.formatGroupCallPeekInfoForRedux: device had no user ID; using fallback UUID'
          );
        }
        return '00000000-0000-4000-8000-000000000000';
      }),
      creatorUuid: peekInfo.creator && bytesToUuid(peekInfo.creator),
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
        let uuid = bytesToUuid(remoteDeviceState.userId);
        if (!uuid) {
          log.error(
            'Calling.formatGroupCallForRedux: could not convert remote participant UUID Uint8Array to string; using fallback UUID'
          );
          uuid = '00000000-0000-4000-8000-000000000000';
        }
        return {
          uuid,
          demuxId: remoteDeviceState.demuxId,
          hasRemoteAudio: !remoteDeviceState.audioMuted,
          hasRemoteVideo: !remoteDeviceState.videoMuted,
          presenting: Boolean(remoteDeviceState.presenting),
          sharingScreen: Boolean(remoteDeviceState.sharingScreen),
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

  private async sendGroupCallUpdateMessage(
    conversationId: string,
    eraId: string
  ): Promise<void> {
    const conversation = window.ConversationController.get(conversationId);
    if (!conversation) {
      log.error(
        'Unable to send group call update message for non-existent conversation'
      );
      return;
    }

    const groupV2 = conversation.getGroupV2Info();
    const sendOptions = await getSendOptions(conversation.attributes);
    if (!groupV2) {
      log.error(
        'Unable to send group call update message for conversation that lacks groupV2 info'
      );
      return;
    }

    const timestamp = Date.now();

    // We "fire and forget" because sending this message is non-essential.
    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;
    wrapWithSyncMessageSend({
      conversation,
      logId: `sendToGroup/groupCallUpdate/${conversationId}-${eraId}`,
      messageIds: [],
      send: () =>
        conversation.queueJob('sendGroupCallUpdateMessage', () =>
          window.Signal.Util.sendToGroup({
            contentHint: ContentHint.DEFAULT,
            groupSendOptions: {
              groupCallUpdate: { eraId },
              groupV2,
              timestamp,
            },
            messageId: undefined,
            sendOptions,
            sendTarget: conversation.toSenderKeyTarget(),
            sendType: 'callingMessage',
            urgent: false,
          })
        ),
      sendType: 'callingMessage',
      timestamp,
    }).catch(err => {
      log.error(
        'Failed to send group call update:',
        err && err.stack ? err.stack : err
      );
    });
  }

  async acceptDirectCall(
    conversationId: string,
    asVideoCall: boolean
  ): Promise<void> {
    log.info('CallingClass.acceptDirectCall()');

    const callId = this.getCallIdForConversation(conversationId);
    if (!callId) {
      log.warn('Trying to accept a non-existent call');
      return;
    }

    const haveMediaPermissions = await this.requestPermissions(asVideoCall);
    if (haveMediaPermissions) {
      await this.startDeviceReselectionTimer();
      RingRTC.setVideoCapturer(callId, this.videoCapturer);
      RingRTC.setVideoRenderer(callId, this.videoRenderer);
      RingRTC.accept(callId, asVideoCall);
    } else {
      log.info('Permissions were denied, call not allowed, hanging up.');
      RingRTC.hangup(callId);
    }
  }

  declineDirectCall(conversationId: string): void {
    log.info('CallingClass.declineDirectCall()');

    const callId = this.getCallIdForConversation(conversationId);
    if (!callId) {
      log.warn('declineDirectCall: Trying to decline a non-existent call');
      return;
    }

    RingRTC.decline(callId);
  }

  declineGroupCall(conversationId: string, ringId: bigint): void {
    log.info('CallingClass.declineGroupCall()');

    const groupId =
      window.ConversationController.get(conversationId)?.get('groupId');
    if (!groupId) {
      log.error(
        'declineGroupCall: could not find the group ID for that conversation'
      );
      return;
    }
    const groupIdBuffer = Buffer.from(Bytes.fromBase64(groupId));

    RingRTC.cancelGroupRing(
      groupIdBuffer,
      ringId,
      RingCancelReason.DeclinedByUser
    );
  }

  hangup(conversationId: string): void {
    log.info('CallingClass.hangup()');

    const specificCall = getOwn(this.callsByConversation, conversationId);
    if (!specificCall) {
      log.error(
        `hangup: Trying to hang up a non-existent call for conversation ${conversationId}`
      );
    }

    ipcRenderer.send('close-screen-share-controller');

    const entries = Object.entries(this.callsByConversation);
    log.info(`hangup: ${entries.length} call(s) to hang up...`);

    entries.forEach(([callConversationId, call]) => {
      log.info(`hangup: Hanging up conversation ${callConversationId}`);
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
    });

    log.info('hangup: Done.');
  }

  setOutgoingAudio(conversationId: string, enabled: boolean): void {
    const call = getOwn(this.callsByConversation, conversationId);
    if (!call) {
      log.warn('Trying to set outgoing audio for a non-existent call');
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
      log.warn('Trying to set outgoing video for a non-existent call');
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

  private setOutgoingVideoIsScreenShare(
    call: Call | GroupCall,
    enabled: boolean
  ): void {
    if (call instanceof Call) {
      RingRTC.setOutgoingVideoIsScreenShare(call.callId, enabled);
      // Note: there is no "presenting" API for direct calls.
    } else if (call instanceof GroupCall) {
      call.setOutgoingVideoIsScreenShare(enabled);
      call.setPresenting(enabled);
    } else {
      throw missingCaseError(call);
    }
  }

  async getPresentingSources(): Promise<Array<PresentableSource>> {
    const sources: ReadonlyArray<DesktopCapturerSource> =
      await ipcRenderer.invoke('getScreenCaptureSources');

    const presentableSources: Array<PresentableSource> = [];

    sources.forEach(source => {
      // If electron can't retrieve a thumbnail then it won't be able to
      // present this source so we filter these out.
      if (source.thumbnail.isEmpty()) {
        return;
      }
      presentableSources.push({
        appIcon:
          source.appIcon && !source.appIcon.isEmpty()
            ? source.appIcon.toDataURL()
            : undefined,
        id: source.id,
        name: translateSourceName(window.i18n, source),
        isScreen: isScreenSource(source),
        thumbnail: source.thumbnail.toDataURL(),
      });
    });

    return presentableSources;
  }

  setPresenting(
    conversationId: string,
    hasLocalVideo: boolean,
    source?: PresentedSource
  ): void {
    const call = getOwn(this.callsByConversation, conversationId);
    if (!call) {
      log.warn('Trying to set presenting for a non-existent call');
      return;
    }

    this.videoCapturer.disable();
    if (source) {
      this.hadLocalVideoBeforePresenting = hasLocalVideo;
      this.videoCapturer.enableCaptureAndSend(call, {
        // 15fps is much nicer but takes up a lot more CPU.
        maxFramerate: 5,
        maxHeight: 1080,
        maxWidth: 1920,
        screenShareSourceId: source.id,
      });
      this.setOutgoingVideo(conversationId, true);
    } else {
      this.setOutgoingVideo(
        conversationId,
        this.hadLocalVideoBeforePresenting ?? hasLocalVideo
      );
      this.hadLocalVideoBeforePresenting = undefined;
    }

    const isPresenting = Boolean(source);
    this.setOutgoingVideoIsScreenShare(call, isPresenting);

    if (source) {
      ipcRenderer.send('show-screen-share', source.name);
      notificationService.notify({
        icon: 'images/icons/v2/video-solid-24.svg',
        message: window.i18n('calling__presenting--notification-body'),
        onNotificationClick: () => {
          if (this.uxActions) {
            this.uxActions.setPresenting();
          }
        },
        silent: true,
        title: window.i18n('calling__presenting--notification-title'),
      });
    } else {
      ipcRenderer.send('close-screen-share-controller');
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
    clearTimeoutIfNecessary(this.deviceReselectionTimer);
    this.deviceReselectionTimer = undefined;
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
      log.info(
        'MediaDevice: available devices changed (from->to)',
        this.lastMediaDeviceSettings,
        newSettings
      );

      await this.selectPreferredDevices(newSettings);
      this.lastMediaDeviceSettings = newSettings;
      this.uxActions?.refreshIODevices(newSettings);
    }
  }

  async getAvailableIODevices(): Promise<AvailableIODevicesType> {
    const availableCameras = await this.videoCapturer.enumerateDevices();
    const availableMicrophones = RingRTC.getAudioInputs();
    const availableSpeakers = RingRTC.getAudioOutputs();

    return {
      availableCameras,
      availableMicrophones,
      availableSpeakers,
    };
  }

  async getMediaDeviceSettings(): Promise<MediaDeviceSettings> {
    const { previousAudioDeviceModule, currentAudioDeviceModule } = this;
    if (!previousAudioDeviceModule || !currentAudioDeviceModule) {
      throw new Error(
        'Calling#getMediaDeviceSettings cannot be called before audio device settings are set'
      );
    }

    const { availableCameras, availableMicrophones, availableSpeakers } =
      await this.getAvailableIODevices();

    const preferredMicrophone = window.Events.getPreferredAudioInputDevice();
    const selectedMicIndex = findBestMatchingAudioDeviceIndex({
      available: availableMicrophones,
      preferred: preferredMicrophone,
      previousAudioDeviceModule,
      currentAudioDeviceModule,
    });
    const selectedMicrophone =
      selectedMicIndex !== undefined
        ? availableMicrophones[selectedMicIndex]
        : undefined;

    const preferredSpeaker = window.Events.getPreferredAudioOutputDevice();
    const selectedSpeakerIndex = findBestMatchingAudioDeviceIndex({
      available: availableSpeakers,
      preferred: preferredSpeaker,
      previousAudioDeviceModule,
      currentAudioDeviceModule,
    });
    const selectedSpeaker =
      selectedSpeakerIndex !== undefined
        ? availableSpeakers[selectedSpeakerIndex]
        : undefined;

    const preferredCamera = window.Events.getPreferredVideoInputDevice();
    const selectedCamera = findBestMatchingCameraId(
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

  setPreferredMicrophone(device: AudioDevice): void {
    log.info('MediaDevice: setPreferredMicrophone', device);
    window.Events.setPreferredAudioInputDevice(device);
    RingRTC.setAudioInput(device.index);
  }

  setPreferredSpeaker(device: AudioDevice): void {
    log.info('MediaDevice: setPreferredSpeaker', device);
    window.Events.setPreferredAudioOutputDevice(device);
    RingRTC.setAudioOutput(device.index);
  }

  enableLocalCamera(): void {
    this.videoCapturer.enableCapture();
  }

  disableLocalVideo(): void {
    this.videoCapturer.disable();
  }

  async setPreferredCamera(device: string): Promise<void> {
    log.info('MediaDevice: setPreferredCamera', device);
    window.Events.setPreferredVideoInputDevice(device);
    await this.videoCapturer.setPreferredDevice(device);
  }

  async handleCallingMessage(
    envelope: ProcessedEnvelope,
    callingMessage: Proto.ICallingMessage
  ): Promise<void> {
    log.info('CallingClass.handleCallingMessage()');

    const enableIncomingCalls = window.Events.getIncomingCallNotification();
    if (callingMessage.offer && !enableIncomingCalls) {
      // Drop offers silently if incoming call notifications are disabled.
      log.info('Incoming calls are disabled, ignoring call offer.');
      return;
    }

    const remoteUserId = envelope.sourceUuid;
    const remoteDeviceId = this.parseDeviceId(envelope.sourceDevice);
    if (!remoteUserId || !remoteDeviceId || !this.localDeviceId) {
      log.error('Missing identifier, ignoring call message.');
      return;
    }

    const { storage } = window.textsecure;

    const senderIdentityRecord =
      await storage.protocol.getOrMigrateIdentityRecord(new UUID(remoteUserId));
    if (!senderIdentityRecord) {
      log.error('Missing sender identity record; ignoring call message.');
      return;
    }
    const senderIdentityKey = senderIdentityRecord.publicKey.slice(1); // Ignore the type header, it is not used.

    const ourUuid = storage.user.getCheckedUuid();

    const receiverIdentityRecord = storage.protocol.getIdentityRecord(ourUuid);
    if (!receiverIdentityRecord) {
      log.error('Missing receiver identity record; ignoring call message.');
      return;
    }
    const receiverIdentityKey = receiverIdentityRecord.publicKey.slice(1); // Ignore the type header, it is not used.

    const conversation = window.ConversationController.get(remoteUserId);
    if (!conversation) {
      log.error('Missing conversation; ignoring call message.');
      return;
    }

    if (callingMessage.offer && !conversation.getAccepted()) {
      log.info(
        'Conversation was not approved by user; rejecting call message.'
      );

      const hangup = new HangupMessage();
      hangup.callId = callingMessage.offer.callId;
      hangup.deviceId = remoteDeviceId;
      hangup.type = HangupType.NeedPermission;

      const message = new CallingMessage();
      message.legacyHangup = hangup;

      await this.handleOutgoingSignaling(remoteUserId, message);

      const ProtoOfferType = Proto.CallingMessage.Offer.Type;
      this.addCallHistoryForFailedIncomingCall(
        conversation,
        callingMessage.offer.type === ProtoOfferType.OFFER_VIDEO_CALL,
        envelope.timestamp
      );

      return;
    }

    const sourceUuid = envelope.sourceUuid
      ? uuidToBytes(envelope.sourceUuid)
      : null;

    const messageAgeSec = envelope.messageAgeSec ? envelope.messageAgeSec : 0;

    log.info('CallingClass.handleCallingMessage(): Handling in RingRTC');

    RingRTC.handleCallingMessage(
      remoteUserId,
      sourceUuid ? Buffer.from(sourceUuid) : null,
      remoteDeviceId,
      this.localDeviceId,
      messageAgeSec,
      envelope.receivedAtCounter,
      protoToCallingMessage(callingMessage),
      Buffer.from(senderIdentityKey),
      Buffer.from(receiverIdentityKey)
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
      log.info('MediaDevice: selecting camera', settings.selectedCamera);
      await this.videoCapturer.setPreferredDevice(settings.selectedCamera);
    }

    // Assume that the MediaDeviceSettings have been obtained very recently and
    // the index is still valid (no devices have been plugged in in between).
    if (settings.selectedMicrophone) {
      log.info(
        'MediaDevice: selecting microphone',
        settings.selectedMicrophone
      );
      RingRTC.setAudioInput(settings.selectedMicrophone.index);
    }

    if (settings.selectedSpeaker) {
      log.info('MediaDevice: selecting speaker', settings.selectedSpeaker);
      RingRTC.setAudioOutput(settings.selectedSpeaker.index);
    }
  }

  private async requestCameraPermissions(): Promise<boolean> {
    const cameraPermission = await window.getMediaCameraPermissions();
    if (!cameraPermission) {
      await window.showPermissionsPopup(true, true);

      // Check the setting again (from the source of truth).
      return window.getMediaCameraPermissions();
    }

    return true;
  }

  private async requestPermissions(isVideoCall: boolean): Promise<boolean> {
    const microphonePermission = await requestMicrophonePermissions(true);
    if (microphonePermission) {
      if (isVideoCall) {
        return this.requestCameraPermissions();
      }

      return true;
    }

    return false;
  }

  private async handleSendCallMessage(
    recipient: Uint8Array,
    data: Uint8Array,
    urgency: CallMessageUrgency
  ): Promise<boolean> {
    const userId = bytesToUuid(recipient);
    if (!userId) {
      log.error('handleSendCallMessage(): bad recipient UUID');
      return false;
    }
    const message = new CallingMessage();
    message.opaque = new OpaqueMessage();
    message.opaque.data = Buffer.from(data);
    return this.handleOutgoingSignaling(userId, message, urgency);
  }

  private async handleSendCallMessageToGroup(
    groupIdBytes: Buffer,
    data: Buffer,
    urgency: CallMessageUrgency
  ): Promise<void> {
    const groupId = groupIdBytes.toString('base64');
    const conversation = window.ConversationController.get(groupId);
    if (!conversation) {
      log.error('handleSendCallMessageToGroup(): could not find conversation');
      return;
    }

    const timestamp = Date.now();

    const callingMessage = new CallingMessage();
    callingMessage.opaque = new OpaqueMessage();
    callingMessage.opaque.data = data;
    const contentMessage = new Proto.Content();
    contentMessage.callingMessage = callingMessageToProto(
      callingMessage,
      urgency
    );

    // We "fire and forget" because sending this message is non-essential.
    // We also don't sync this message.
    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;
    await conversation.queueJob('handleSendCallMessageToGroup', async () =>
      handleMessageSend(
        window.Signal.Util.sendContentMessageToGroup({
          contentHint: ContentHint.DEFAULT,
          contentMessage,
          isPartialSend: false,
          messageId: undefined,
          recipients: conversation.getRecipients(),
          sendOptions: await getSendOptions(conversation.attributes),
          sendTarget: conversation.toSenderKeyTarget(),
          sendType: 'callingMessage',
          timestamp,
          urgent: false,
        }),
        { messageIds: [], sendType: 'callingMessage' }
      )
    );
  }

  private async handleGroupCallRingUpdate(
    groupIdBytes: Buffer,
    ringId: bigint,
    ringerBytes: Buffer,
    update: RingUpdate
  ): Promise<void> {
    log.info(`handleGroupCallRingUpdate(): got ring update ${update}`);

    const groupId = groupIdBytes.toString('base64');

    const ringerUuid = bytesToUuid(ringerBytes);
    if (!ringerUuid) {
      log.error('handleGroupCallRingUpdate(): ringerUuid was invalid');
      return;
    }

    const conversation = window.ConversationController.get(groupId);
    if (!conversation) {
      log.error('handleGroupCallRingUpdate(): could not find conversation');
      return;
    }
    const conversationId = conversation.id;

    let shouldRing = false;

    if (update === RingUpdate.Requested) {
      const processResult = await processGroupCallRingRequest(ringId);
      switch (processResult) {
        case ProcessGroupCallRingRequestResult.ShouldRing:
          shouldRing = true;
          break;
        case ProcessGroupCallRingRequestResult.RingWasPreviouslyCanceled:
          RingRTC.cancelGroupRing(groupIdBytes, ringId, null);
          break;
        case ProcessGroupCallRingRequestResult.ThereIsAnotherActiveRing:
          RingRTC.cancelGroupRing(groupIdBytes, ringId, RingCancelReason.Busy);
          break;
        default:
          throw missingCaseError(processResult);
      }
    } else {
      await processGroupCallRingCancelation(ringId);
    }

    if (shouldRing) {
      log.info('handleGroupCallRingUpdate: ringing');
      this.uxActions?.receiveIncomingGroupCall({
        conversationId,
        ringId,
        ringerUuid,
      });
    } else {
      log.info('handleGroupCallRingUpdate: canceling any existing ring');
      this.uxActions?.cancelIncomingGroupCallRing({
        conversationId,
        ringId,
      });
    }
  }

  private async handleOutgoingSignaling(
    remoteUserId: UserId,
    message: CallingMessage,
    urgency?: CallMessageUrgency
  ): Promise<boolean> {
    const conversation = window.ConversationController.get(remoteUserId);
    const sendOptions = conversation
      ? await getSendOptions(conversation.attributes)
      : undefined;

    if (!window.textsecure.messaging) {
      log.warn('handleOutgoingSignaling() returning false; offline');
      return false;
    }

    try {
      const result = await handleMessageSend(
        window.textsecure.messaging.sendCallingMessage(
          remoteUserId,
          callingMessageToProto(message, urgency),
          sendOptions
        ),
        { messageIds: [], sendType: 'callingMessage' }
      );

      if (result && result.errors && result.errors.length) {
        throw result.errors[0];
      }

      log.info('handleOutgoingSignaling() completed successfully');
      return true;
    } catch (err) {
      if (err && err.errors && err.errors.length > 0) {
        log.error(`handleOutgoingSignaling() failed: ${err.errors[0].reason}`);
      } else {
        log.error('handleOutgoingSignaling() failed');
      }
      return false;
    }
  }

  // If we return null here, we hang up the call.
  private async handleIncomingCall(call: Call): Promise<CallSettings | null> {
    log.info('CallingClass.handleIncomingCall()');

    if (!this.uxActions || !this.localDeviceId) {
      log.error('Missing required objects, ignoring incoming call.');
      return null;
    }

    const conversation = window.ConversationController.get(call.remoteUserId);
    if (!conversation) {
      log.error('Missing conversation, ignoring incoming call.');
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
        log.info(
          `Peer is not trusted, ignoring incoming call for conversation: ${conversation.idForLogging()}`
        );
        this.addCallHistoryForFailedIncomingCall(
          conversation,
          call.isVideoCall,
          Date.now()
        );
        return null;
      }

      this.attachToCall(conversation, call);

      this.uxActions.receiveIncomingDirectCall({
        conversationId: conversation.id,
        isVideoCall: call.isVideoCall,
      });

      log.info('CallingClass.handleIncomingCall(): Proceeding');

      return await this.getCallSettings(conversation);
    } catch (err) {
      log.error(`Ignoring incoming call: ${err.stack}`);
      this.addCallHistoryForFailedIncomingCall(
        conversation,
        call.isVideoCall,
        Date.now()
      );
      return null;
    }
  }

  private handleAutoEndedIncomingCallRequest(
    remoteUserId: UserId,
    reason: CallEndedReason,
    ageInSeconds: number,
    wasVideoCall: boolean,
    receivedAtCounter: number | undefined
  ) {
    const conversation = window.ConversationController.get(remoteUserId);
    if (!conversation) {
      return;
    }

    // This is extra defensive, just in case RingRTC passes us a bad value. (It probably
    //   won't.)
    const ageInMilliseconds =
      isNormalNumber(ageInSeconds) && ageInSeconds >= 0
        ? ageInSeconds * durations.SECOND
        : 0;
    const endedTime = Date.now() - ageInMilliseconds;

    this.addCallHistoryForAutoEndedIncomingCall(
      conversation,
      reason,
      endedTime,
      wasVideoCall,
      receivedAtCounter
    );
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

    // eslint-disable-next-line no-param-reassign
    call.handleRemoteSharingScreen = () => {
      uxActions.remoteSharingScreenChange({
        conversationId: conversation.id,
        isSharingScreen: Boolean(call.remoteSharingScreen),
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
        log.info(`${fileName}:${line} ${message}`);
        break;
      case CallLogLevel.Warn:
        log.warn(`${fileName}:${line} ${message}`);
        break;
      case CallLogLevel.Error:
        log.error(`${fileName}:${line} ${message}`);
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
    body: Uint8Array | undefined
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
        RingRTC.receivedHttpResponse(requestId, err.code, Buffer.alloc(0));
      } else {
        log.error('handleSendHttpRequest: fetch failed with error', err);
        RingRTC.httpRequestFailed(requestId, String(err));
      }
      return;
    }

    RingRTC.receivedHttpResponse(
      requestId,
      result.response.status,
      Buffer.from(result.data)
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

    const iceServer = await window.textsecure.messaging.server.getIceServers();

    const shouldRelayCalls = window.Events.getAlwaysRelayCalls();

    // If the peer is 'unknown', i.e. not in the contact list, force IP hiding.
    const isContactUnknown = !conversation.isFromOrAddedByTrustedContact();

    return {
      iceServer: {
        ...iceServer,
        urls: iceServer.urls.slice(),
      },
      hideIp: shouldRelayCalls || isContactUnknown,
      bandwidthMode: BandwidthMode.Normal,
      // TODO: DESKTOP-3101
      // audioLevelsIntervalMillis: AUDIO_LEVEL_INTERVAL_MS,
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

    conversation.addCallHistory(
      {
        callMode: CallMode.Direct,
        wasIncoming: call.isIncoming,
        wasVideoCall: call.isVideoCall,
        wasDeclined,
        acceptedTime,
        endedTime: Date.now(),
      },
      undefined
    );
  }

  private addCallHistoryForFailedIncomingCall(
    conversation: ConversationModel,
    wasVideoCall: boolean,
    timestamp: number
  ) {
    conversation.addCallHistory(
      {
        callMode: CallMode.Direct,
        wasIncoming: true,
        wasVideoCall,
        // Since the user didn't decline, make sure it shows up as a missed call instead
        wasDeclined: false,
        acceptedTime: undefined,
        endedTime: timestamp,
      },
      undefined
    );
  }

  private addCallHistoryForAutoEndedIncomingCall(
    conversation: ConversationModel,
    reason: CallEndedReason,
    endedTime: number,
    wasVideoCall: boolean,
    receivedAtCounter: number | undefined
  ) {
    let wasDeclined = false;
    let acceptedTime;

    if (reason === CallEndedReason.AcceptedOnAnotherDevice) {
      acceptedTime = endedTime;
    } else if (reason === CallEndedReason.DeclinedOnAnotherDevice) {
      wasDeclined = true;
    }
    // Otherwise it will show up as a missed call.

    conversation.addCallHistory(
      {
        callMode: CallMode.Direct,
        wasIncoming: true,
        wasVideoCall,
        wasDeclined,
        acceptedTime,
        endedTime,
      },
      receivedAtCounter
    );
  }

  public async updateCallHistoryForGroupCall(
    conversationId: string,
    peekInfo: undefined | PeekInfo
  ): Promise<void> {
    // If we don't have the necessary pieces to peek, bail. (It's okay if we don't.)
    if (!peekInfo || !peekInfo.eraId || !peekInfo.creator) {
      return;
    }
    const creatorUuid = bytesToUuid(peekInfo.creator);
    if (!creatorUuid) {
      log.error('updateCallHistoryForGroupCall(): bad creator UUID');
      return;
    }
    const creatorConversation = window.ConversationController.get(creatorUuid);

    const conversation = window.ConversationController.get(conversationId);
    if (!conversation) {
      log.error('updateCallHistoryForGroupCall(): could not find conversation');
      return;
    }

    const isNewCall = await conversation.updateCallHistoryForGroupCall(
      peekInfo.eraId,
      creatorUuid
    );
    const wasStartedByMe = Boolean(
      creatorConversation && isMe(creatorConversation.attributes)
    );
    const isAnybodyElseInGroupCall = Boolean(peekInfo.devices.length);

    if (
      isNewCall &&
      !wasStartedByMe &&
      isAnybodyElseInGroupCall &&
      !conversation.isMuted()
    ) {
      this.notifyForGroupCall(conversation, creatorConversation);
    }
  }

  private notifyForGroupCall(
    conversation: Readonly<ConversationModel>,
    creatorConversation: undefined | Readonly<ConversationModel>
  ): void {
    let notificationTitle: string;
    let notificationMessage: string;

    switch (notificationService.getNotificationSetting()) {
      case NotificationSetting.Off:
        return;
      case NotificationSetting.NoNameOrMessage:
        notificationTitle = FALLBACK_NOTIFICATION_TITLE;
        notificationMessage = window.i18n(
          'calling__call-notification__started-by-someone'
        );
        break;
      default:
        // These fallbacks exist just in case something unexpected goes wrong.
        notificationTitle =
          conversation?.getTitle() || FALLBACK_NOTIFICATION_TITLE;
        notificationMessage = creatorConversation
          ? window.i18n('calling__call-notification__started', [
              creatorConversation.getTitle(),
            ])
          : window.i18n('calling__call-notification__started-by-someone');
        break;
    }

    notificationService.notify({
      icon: 'images/icons/v2/video-solid-24.svg',
      message: notificationMessage,
      onNotificationClick: () => {
        this.uxActions?.startCallingLobby({
          conversationId: conversation.id,
          isVideoCall: true,
        });
      },
      silent: false,
      title: notificationTitle,
    });
  }

  private async cleanExpiredGroupCallRingsAndLoop(): Promise<void> {
    try {
      await cleanExpiredGroupCallRings();
    } catch (err: unknown) {
      // These errors are ignored here. They should be logged elsewhere and it's okay if
      //   we don't do a cleanup this time.
    }

    setTimeout(() => {
      this.cleanExpiredGroupCallRingsAndLoop();
    }, CLEAN_EXPIRED_GROUP_CALL_RINGS_INTERVAL);
  }
}

export const calling = new CallingClass();
