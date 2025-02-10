// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';
import type {
  AudioDevice,
  CallId,
  DeviceId,
  GroupCallObserver,
  PeekInfo,
  UserId,
  VideoFrameSource,
  VideoRequest,
} from '@signalapp/ringrtc';
import {
  AnswerMessage,
  BusyMessage,
  Call,
  CallingMessage,
  CallMessageUrgency,
  CallLinkRootKey,
  CallLogLevel,
  CallState,
  CanvasVideoRenderer,
  ConnectionState,
  DataMode,
  JoinState,
  HttpMethod,
  GroupCall,
  GroupMemberInfo,
  GumVideoCapturer,
  HangupMessage,
  HangupType,
  IceCandidateMessage,
  OfferMessage,
  OpaqueMessage,
  RingCancelReason,
  RingRTC,
  RingUpdate,
  GroupCallKind,
  SpeechEvent,
} from '@signalapp/ringrtc';
import { uniqBy, noop, compact } from 'lodash';

import Long from 'long';
import type { CallLinkAuthCredentialPresentation } from '@signalapp/libsignal-client/zkgroup';
import {
  CallLinkSecretParams,
  CreateCallLinkCredentialRequestContext,
  CreateCallLinkCredentialResponse,
  GenericServerPublicParams,
} from '@signalapp/libsignal-client/zkgroup';
import { Aci } from '@signalapp/libsignal-client';
import type { GumVideoCaptureOptions } from '@signalapp/ringrtc/dist/ringrtc/VideoSupport';
import type {
  ActionsType as CallingReduxActionsType,
  GroupCallParticipantInfoType,
  GroupCallPeekInfoType,
} from '../state/ducks/calling';
import type { ConversationType } from '../state/ducks/conversations';
import { getConversationCallMode } from '../state/ducks/conversations';
import { isMe } from '../util/whatTypeOfConversation';
import type {
  AvailableIODevicesType,
  CallEndedReason,
  MediaDeviceSettings,
  PresentedSource,
} from '../types/Calling';
import {
  GroupCallConnectionState,
  GroupCallJoinState,
  ScreenShareStatus,
} from '../types/Calling';
import { CallMode, LocalCallEvent } from '../types/CallDisposition';
import {
  findBestMatchingAudioDeviceIndex,
  findBestMatchingCameraId,
} from '../calling/findBestMatchingDevice';
import { normalizeAci } from '../util/normalizeAci';
import { isAciString } from '../util/isAciString';
import * as Errors from '../types/errors';
import type { ConversationModel } from '../models/conversations';
import * as Bytes from '../Bytes';
import { uuidToBytes, bytesToUuid } from '../util/uuidToBytes';
import { drop } from '../util/drop';
import { dropNull } from '../util/dropNull';
import { getOwn } from '../util/getOwn';
import * as durations from '../util/durations';
import { clearTimeoutIfNecessary } from '../util/clearTimeoutIfNecessary';
import { fetchMembershipProof, getMembershipList } from '../groups';
import type { ProcessedEnvelope } from '../textsecure/Types.d';
import type { GetIceServersResultType } from '../textsecure/WebAPI';
import { missingCaseError } from '../util/missingCaseError';
import { normalizeGroupCallTimestamp } from '../util/ringrtc/normalizeGroupCallTimestamp';
import {
  AUDIO_LEVEL_INTERVAL_MS,
  REQUESTED_VIDEO_WIDTH,
  REQUESTED_VIDEO_HEIGHT,
  REQUESTED_VIDEO_FRAMERATE,
  REQUESTED_SCREEN_SHARE_WIDTH,
  REQUESTED_SCREEN_SHARE_HEIGHT,
  REQUESTED_SCREEN_SHARE_FRAMERATE,
} from '../calling/constants';
import { callingMessageToProto } from '../util/callingMessageToProto';
import { requestMicrophonePermissions } from '../util/requestMicrophonePermissions';
import { SignalService as Proto } from '../protobuf';
import { DataReader, DataWriter } from '../sql/Client';
import {
  notificationService,
  NotificationSetting,
  FALLBACK_NOTIFICATION_TITLE,
  NotificationType,
  shouldSaveNotificationAvatarToDisk,
} from './notifications';
import * as log from '../logging/log';
import { assertDev, strictAssert } from '../util/assert';
import {
  formatLocalDeviceState,
  formatPeekInfo,
  getPeerIdFromConversation,
  getLocalCallEventFromCallEndedReason,
  getCallDetailsFromEndedDirectCall,
  getCallEventDetails,
  getLocalCallEventFromJoinState,
  getLocalCallEventFromDirectCall,
  getCallDetailsFromDirectCall,
  getCallDetailsFromGroupCallMeta,
  updateCallHistoryFromLocalEvent,
  getGroupCallMeta,
  getCallIdFromRing,
  getLocalCallEventFromRingUpdate,
  convertJoinState,
  updateAdhocCallHistory,
  getCallIdFromEra,
  getCallDetailsForAdhocCall,
} from '../util/callDisposition';
import { isNormalNumber } from '../util/isNormalNumber';
import type { AciString, ServiceIdString } from '../types/ServiceId';
import { isServiceIdString } from '../types/ServiceId';
import { isSignalConnection } from '../util/getSignalConnections';
import { toAdminKeyBytes } from '../util/callLinks';
import {
  getCallLinkAuthCredentialPresentation,
  getRoomIdFromRootKey,
  callLinkRestrictionsToRingRTC,
  callLinkStateFromRingRTC,
} from '../util/callLinksRingrtc';
import {
  conversationJobQueue,
  conversationQueueJobEnum,
} from '../jobs/conversationJobQueue';
import type { CallLinkType, CallLinkStateType } from '../types/CallLink';
import { CallLinkRestrictions } from '../types/CallLink';
import { getConversationIdForLogging } from '../util/idForLogging';
import { sendCallLinkUpdateSync } from '../util/sendCallLinkUpdateSync';
import { createIdenticon } from '../util/createIdenticon';
import { getColorForCallLink } from '../util/getColorForCallLink';
import { getUseRingrtcAdm } from '../util/ringrtc/ringrtcAdm';
import OS from '../util/os/osMain';
import { isLowerHandSuggestionEnabled } from '../util/isLowerHandSuggestionEnabled';

const { wasGroupCallRingPreviouslyCanceled } = DataReader;
const {
  processGroupCallRingCancellation,
  cleanExpiredGroupCallRingCancellations,
} = DataWriter;

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

const ICE_SERVER_IS_IP_LIKE = /(turn|turns|stun):[.\d]+/;
const MAX_CALL_DEBUG_STATS_TABS = 5;

// We send group call update messages to tell other clients to peek, which triggers
//   notifications, timeline messages, big green "Join" buttons, and so on. This enum
//   represents the three possible states we can be in. This helps ensure that we don't
//   send an update on disconnect if we never sent one when we joined.
enum GroupCallUpdateMessageState {
  SentNothing,
  SentJoin,
  SentLeft,
}

type CallingReduxInterface = Pick<
  CallingReduxActionsType,
  | 'callStateChange'
  | 'cancelIncomingGroupCallRing'
  | 'cancelPresenting'
  | 'groupCallAudioLevelsChange'
  | 'groupCallEnded'
  | 'groupCallRaisedHandsChange'
  | 'groupCallStateChange'
  | 'joinedAdhocCall'
  | 'outgoingCall'
  | 'receiveGroupCallReactions'
  | 'receiveIncomingDirectCall'
  | 'receiveIncomingGroupCall'
  | 'refreshIODevices'
  | 'remoteSharingScreenChange'
  | 'remoteVideoChange'
  | 'sendGroupCallRaiseHand'
  | 'startCallingLobby'
  | 'startCallLinkLobby'
  | 'startCallLinkLobbyByRoomId'
  | 'peekNotConnectedGroupCall'
  | 'setSuggestLowerHand'
> & {
  areAnyCallsActiveOrRinging(): boolean;
};

export type SetPresentingOptionsType = Readonly<{
  conversationId: string;
  hasLocalVideo: boolean;
  mediaStream?: MediaStream;
  source?: PresentedSource;
  callLinkRootKey?: string;
}>;

function truncateForLogging(name: string | undefined): string | undefined {
  if (!name || name.length <= 4) {
    return name;
  }
  return `${name.slice(0, 2)}...${name.slice(-2)}`;
}

function cleanForLogging(settings?: MediaDeviceSettings): unknown {
  if (!settings) {
    return settings;
  }

  return {
    availableCameras: settings.availableCameras.map(camera => {
      const { deviceId, kind, label, groupId } = camera;
      return {
        deviceId,
        kind,
        label: truncateForLogging(label),
        groupId,
      };
    }),
    availableMicrophones: settings.availableMicrophones.map(device => {
      return truncateForLogging(device.name);
    }),
    availableSpeakers: settings.availableSpeakers.map(device => {
      return truncateForLogging(device.name);
    }),
    selectedMicrophone: truncateForLogging(settings.selectedMicrophone?.name),
    selectedSpeaker: truncateForLogging(settings.selectedSpeaker?.name),
    selectedCamera: settings.selectedCamera,
  };
}

function protoToCallingMessage({
  offer,
  answer,
  iceUpdate,
  busy,
  hangup,
  destinationDeviceId,
  opaque,
}: Proto.ICallMessage): CallingMessage {
  const newIceCandidates: Array<IceCandidateMessage> = [];
  if (iceUpdate) {
    iceUpdate.forEach(candidate => {
      if (candidate.id && candidate.opaque) {
        newIceCandidates.push(
          new IceCandidateMessage(candidate.id, Buffer.from(candidate.opaque))
        );
      }
    });
  }

  return {
    offer:
      offer && offer.id && offer.opaque
        ? new OfferMessage(
            offer.id,
            dropNull(offer.type) as number,
            Buffer.from(offer.opaque)
          )
        : undefined,
    answer:
      answer && answer.id && answer.opaque
        ? new AnswerMessage(answer.id, Buffer.from(answer.opaque))
        : undefined,
    iceCandidates: newIceCandidates.length > 0 ? newIceCandidates : undefined,
    busy: busy && busy.id ? new BusyMessage(busy.id) : undefined,
    hangup:
      hangup && hangup.id
        ? new HangupMessage(
            hangup.id,
            dropNull(hangup.type) as number,
            hangup.deviceId || 0
          )
        : undefined,
    destinationDeviceId: dropNull(destinationDeviceId),
    opaque: opaque
      ? {
          data: opaque.data ? Buffer.from(opaque.data) : undefined,
        }
      : undefined,
  };
}

export type NotifyScreenShareStatusOptionsType = Readonly<
  {
    conversationId?: string;
    isPresenting: boolean;
  } & (
    | {
        callMode: CallMode.Direct;
        callState: CallState;
      }
    | {
        callMode: CallMode.Group | CallMode.Adhoc;
        connectionState: GroupCallConnectionState;
      }
  )
>;

export class CallingClass {
  readonly #videoCapturer: GumVideoCapturer;

  readonly videoRenderer: CanvasVideoRenderer;

  #localPreviewContainer: HTMLDivElement | null = null;
  #localPreview: HTMLVideoElement | undefined;
  #reduxInterface?: CallingReduxInterface;

  public _sfuUrl?: string;

  public _iceServerOverride?: GetIceServersResultType | string;

  #lastMediaDeviceSettings?: MediaDeviceSettings;
  #deviceReselectionTimer?: NodeJS.Timeout;
  #callsLookup: { [key: string]: Call | GroupCall };
  #hadLocalVideoBeforePresenting?: boolean;
  #currentRtcStatsInterval: number | null = null;
  #callDebugNumber: number = 0;

  // Send our profile key to other participants in call link calls to ensure they
  // can see our profile info. Only send once per aci until the next app start.
  #sendProfileKeysForAdhocCallCache: Set<AciString>;

  constructor() {
    this.#videoCapturer = new GumVideoCapturer({
      maxWidth: REQUESTED_VIDEO_WIDTH,
      maxHeight: REQUESTED_VIDEO_HEIGHT,
      maxFramerate: REQUESTED_VIDEO_FRAMERATE,
    });
    this.videoRenderer = new CanvasVideoRenderer();

    this.#callsLookup = {};
    this.#sendProfileKeysForAdhocCallCache = new Set();
  }

  initialize(reduxInterface: CallingReduxInterface, sfuUrl: string): void {
    this.#reduxInterface = reduxInterface;
    if (!reduxInterface) {
      throw new Error('CallingClass.initialize: Invalid uxActions.');
    }

    this._sfuUrl = sfuUrl;

    RingRTC.setConfig({
      field_trials: undefined,
      use_ringrtc_adm: getUseRingrtcAdm(),
    });

    RingRTC.handleOutgoingSignaling = this.#handleOutgoingSignaling.bind(this);
    RingRTC.handleIncomingCall = this.#handleIncomingCall.bind(this);
    RingRTC.handleStartCall = this.#handleStartCall.bind(this);
    RingRTC.handleAutoEndedIncomingCallRequest =
      this.#handleAutoEndedIncomingCallRequest.bind(this);
    RingRTC.handleLogMessage = this.#handleLogMessage.bind(this);
    RingRTC.handleSendHttpRequest = this.#handleSendHttpRequest.bind(this);
    RingRTC.handleSendCallMessage = this.#handleSendCallMessage.bind(this);
    RingRTC.handleSendCallMessageToGroup =
      this.#handleSendCallMessageToGroup.bind(this);
    RingRTC.handleGroupCallRingUpdate =
      this.#handleGroupCallRingUpdate.bind(this);
    RingRTC.handleRtcStatsReport = this.#handleRtcStatsReport.bind(this);

    this.#attemptToGiveOurServiceIdToRingRtc();
    window.Whisper.events.on('userChanged', () => {
      this.#attemptToGiveOurServiceIdToRingRtc();
    });

    ipcRenderer.on('stop-screen-share', () => {
      reduxInterface.cancelPresenting();
    });
    ipcRenderer.on(
      'calling:set-rtc-stats-interval',
      (_, intervalMillis: number | null) => {
        this.setAllRtcStatsInterval(intervalMillis);
      }
    );

    drop(this.#cleanExpiredGroupCallRingsAndLoop());
    drop(this.cleanupStaleRingingCalls());

    if (process.platform === 'darwin') {
      drop(this.#enumerateMediaDevices());
    }
  }

  #maybeUpdateRtcLogging(groupCall: GroupCall): void {
    if (!this.#currentRtcStatsInterval) {
      return;
    }

    groupCall.setRtcStatsInterval(this.#currentRtcStatsInterval);
    this.#callDebugNumber =
      (this.#callDebugNumber + 1) % MAX_CALL_DEBUG_STATS_TABS;
  }

  #attemptToGiveOurServiceIdToRingRtc(): void {
    const ourAci = window.textsecure.storage.user.getAci();
    if (!ourAci) {
      // This can happen if we're not linked. It's okay if we hit this case.
      return;
    }

    RingRTC.setSelfUuid(Buffer.from(uuidToBytes(ourAci)));
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
      case null:
        log.error('Conversation does not support calls, new call not allowed.');
        return;
      case CallMode.Direct: {
        const conversationModel = window.ConversationController.get(
          conversation.id
        );
        if (
          !conversationModel ||
          !this.#getRemoteUserIdFromConversation(conversationModel)
        ) {
          log.error('Missing remote user identifier, new call not allowed.');
          return;
        }
        break;
      }
      case CallMode.Group:
        break;
      case CallMode.Adhoc:
        log.error(
          'startCallingLobby() not implemented for adhoc calls. Did you mean: startCallLinkLobby()?'
        );
        return;
      default:
        throw missingCaseError(callMode);
    }

    if (!this.#reduxInterface) {
      log.error('Missing uxActions, new call not allowed.');
      return;
    }

    if (!this.#localDeviceId) {
      log.error('Missing local device identifier, new call not allowed.');
      return;
    }

    const haveMediaPermissions = await this.#requestPermissions(hasLocalVideo);
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
    await this.#startDeviceReselectionTimer();

    const enableLocalCameraIfNecessary = hasLocalVideo
      ? () => this.enableLocalCamera()
      : noop;

    switch (callMode) {
      case CallMode.Direct:
        // We could easily support this in the future if we need to.
        assertDev(
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
          ...this.#formatGroupCallForRedux(groupCall),
        };
      }
      default:
        throw missingCaseError(callMode);
    }
  }

  stopCallingLobby(conversationId?: string): void {
    this.disableLocalVideo();
    this.#stopDeviceReselectionTimer();
    this.#lastMediaDeviceSettings = undefined;

    if (conversationId) {
      this.#getGroupCall(conversationId)?.disconnect();
    }
  }

  async createCallLink(): Promise<CallLinkType> {
    strictAssert(
      this._sfuUrl,
      'createCallLink() missing SFU URL; not creating call link'
    );

    const sfuUrl = this._sfuUrl;
    const userId = Aci.parseFromServiceIdString(
      window.textsecure.storage.user.getCheckedAci()
    );

    const rootKey = CallLinkRootKey.generate();
    const roomId = rootKey.deriveRoomId();
    const roomIdHex = roomId.toString('hex');
    const logId = `createCallLink(${roomIdHex})`;

    log.info(`${logId}: Creating call link`);

    const adminKey = CallLinkRootKey.generateAdminPassKey();

    const context = CreateCallLinkCredentialRequestContext.forRoomId(roomId);
    const requestBase64 = Bytes.toBase64(context.getRequest().serialize());

    strictAssert(
      window.textsecure.messaging,
      'createCallLink(): We are offline'
    );
    const { credential: credentialBase64 } =
      await window.textsecure.messaging.server.callLinkCreateAuth(
        requestBase64
      );

    const response = new CreateCallLinkCredentialResponse(
      Buffer.from(credentialBase64, 'base64')
    );

    const genericServerPublicParams = new GenericServerPublicParams(
      Buffer.from(window.getGenericServerPublicParams(), 'base64')
    );
    const credential = context.receive(
      response,
      userId,
      genericServerPublicParams
    );

    const secretParams = CallLinkSecretParams.deriveFromRootKey(rootKey.bytes);

    const credentialPresentation = credential
      .present(roomId, userId, genericServerPublicParams, secretParams)
      .serialize();
    const serializedPublicParams = secretParams.getPublicParams().serialize();

    const result = await RingRTC.createCallLink(
      sfuUrl,
      credentialPresentation,
      rootKey,
      adminKey,
      serializedPublicParams,
      CallLinkRestrictions.AdminApproval
    );

    if (!result.success) {
      const message = `Failed to create call link: ${result.errorStatusCode}`;
      log.error(`${logId}: ${message}`);
      throw new Error(message);
    }

    log.info(`${logId}: success`);
    const state = callLinkStateFromRingRTC(result.value);

    const callLink: CallLinkType = {
      roomId: roomIdHex,
      rootKey: rootKey.toString(),
      adminKey: adminKey.toString('base64'),
      storageNeedsSync: true,
      ...state,
    };

    drop(sendCallLinkUpdateSync(callLink));

    return callLink;
  }

  async deleteCallLink(callLink: CallLinkType): Promise<void> {
    strictAssert(
      this._sfuUrl,
      'createCallLink() missing SFU URL; not deleting call link'
    );

    const sfuUrl = this._sfuUrl;
    const logId = `deleteCallLink(${callLink.roomId})`;

    const callLinkRootKey = CallLinkRootKey.parse(callLink.rootKey);
    strictAssert(callLink.adminKey, 'Missing admin key');
    const callLinkAdminKey = toAdminKeyBytes(callLink.adminKey);
    const authCredentialPresentation =
      await getCallLinkAuthCredentialPresentation(callLinkRootKey);

    const result = await RingRTC.deleteCallLink(
      sfuUrl,
      authCredentialPresentation.serialize(),
      callLinkRootKey,
      callLinkAdminKey
    );

    if (!result.success) {
      if (result.errorStatusCode === 404) {
        log.info(`${logId}: Call link not found, already deleted`);
        return;
      }
      const message = `Failed to delete call link: ${result.errorStatusCode}`;
      log.error(`${logId}: ${message}`);
      throw new Error(message);
    }
  }

  async updateCallLinkName(
    callLink: CallLinkType,
    name: string
  ): Promise<CallLinkStateType> {
    strictAssert(
      this._sfuUrl,
      'updateCallLinkName() missing SFU URL; not update call link name'
    );
    const sfuUrl = this._sfuUrl;
    const logId = `updateCallLinkName(${callLink.roomId})`;

    log.info(`${logId}: Updating call link name`);

    const callLinkRootKey = CallLinkRootKey.parse(callLink.rootKey);
    strictAssert(callLink.adminKey, 'Missing admin key');
    const callLinkAdminKey = toAdminKeyBytes(callLink.adminKey);
    const authCredentialPresentation =
      await getCallLinkAuthCredentialPresentation(callLinkRootKey);
    const result = await RingRTC.updateCallLinkName(
      sfuUrl,
      authCredentialPresentation.serialize(),
      callLinkRootKey,
      callLinkAdminKey,
      name
    );

    if (!result.success) {
      const message = `Failed to update call link name: ${result.errorStatusCode}`;
      log.error(`${logId}: ${message}`);
      throw new Error(message);
    }

    drop(sendCallLinkUpdateSync(callLink));

    log.info(`${logId}: success`);
    return callLinkStateFromRingRTC(result.value);
  }

  async updateCallLinkRestrictions(
    callLink: CallLinkType,
    restrictions: CallLinkRestrictions
  ): Promise<CallLinkStateType> {
    strictAssert(
      this._sfuUrl,
      'updateCallLinkRestrictions() missing SFU URL; not update call link restrictions'
    );
    const sfuUrl = this._sfuUrl;
    const logId = `updateCallLinkRestrictions(${callLink.roomId})`;

    log.info(`${logId}: Updating call link restrictions`);

    const callLinkRootKey = CallLinkRootKey.parse(callLink.rootKey);
    strictAssert(callLink.adminKey, 'Missing admin key');
    const callLinkAdminKey = toAdminKeyBytes(callLink.adminKey);
    const authCredentialPresentation =
      await getCallLinkAuthCredentialPresentation(callLinkRootKey);

    const newRestrictions = callLinkRestrictionsToRingRTC(restrictions);
    strictAssert(
      newRestrictions !== CallLinkRestrictions.Unknown,
      'Invalid call link restrictions value'
    );

    const result = await RingRTC.updateCallLinkRestrictions(
      sfuUrl,
      authCredentialPresentation.serialize(),
      callLinkRootKey,
      callLinkAdminKey,
      newRestrictions
    );

    if (!result.success) {
      const message = `Failed to update call link restrictions: ${result.errorStatusCode}`;
      log.error(`${logId}: ${message}`);
      throw new Error(message);
    }

    drop(sendCallLinkUpdateSync(callLink));

    log.info(`${logId}: success`);
    return callLinkStateFromRingRTC(result.value);
  }

  async readCallLink(
    callLinkRootKey: CallLinkRootKey
  ): Promise<CallLinkStateType | null> {
    if (!this._sfuUrl) {
      throw new Error('readCallLink() missing SFU URL; not handling call link');
    }

    const roomId = getRoomIdFromRootKey(callLinkRootKey);
    const logId = `readCallLink(${roomId})`;
    const authCredentialPresentation =
      await getCallLinkAuthCredentialPresentation(callLinkRootKey);

    const result = await RingRTC.readCallLink(
      this._sfuUrl,
      authCredentialPresentation.serialize(),
      callLinkRootKey
    );
    if (!result.success) {
      log.warn(`${logId}: failed with status ${result.errorStatusCode}`);
      if (result.errorStatusCode === 404) {
        return null;
      }
      throw new Error(`Failed to read call link: ${result.errorStatusCode}`);
    }

    log.info(`${logId}: success`);
    return callLinkStateFromRingRTC(result.value);
  }

  async startCallLinkLobby({
    callLinkRootKey,
    adminPasskey,
    hasLocalAudio,
    hasLocalVideo = true,
  }: Readonly<{
    callLinkRootKey: CallLinkRootKey;
    adminPasskey: Buffer | undefined;
    hasLocalAudio: boolean;
    hasLocalVideo?: boolean;
  }>): Promise<
    | undefined
    | {
        callMode: CallMode.Adhoc;
        connectionState: GroupCallConnectionState;
        hasLocalAudio: boolean;
        hasLocalVideo: boolean;
        joinState: GroupCallJoinState;
        peekInfo?: GroupCallPeekInfoType;
        remoteParticipants: Array<GroupCallParticipantInfoType>;
      }
  > {
    const roomId = getRoomIdFromRootKey(callLinkRootKey);
    log.info('startCallLinkLobby() for roomId', roomId);

    await this.#startDeviceReselectionTimer();

    const authCredentialPresentation =
      await getCallLinkAuthCredentialPresentation(callLinkRootKey);

    const groupCall = this.connectCallLinkCall({
      roomId,
      authCredentialPresentation,
      callLinkRootKey,
      adminPasskey,
    });

    groupCall.setOutgoingAudioMuted(!hasLocalAudio);
    groupCall.setOutgoingVideoMuted(!hasLocalVideo);

    this.enableLocalCamera();

    return {
      callMode: CallMode.Adhoc,
      ...this.#formatGroupCallForRedux(groupCall),
    };
  }

  async startOutgoingDirectCall(
    conversationId: string,
    hasLocalAudio: boolean,
    hasLocalVideo: boolean
  ): Promise<void> {
    const conversation = window.ConversationController.get(conversationId);
    if (!conversation) {
      log.error(
        `startOutgoingCall: Could not find conversation ${conversationId}, cannot start call`
      );
      this.stopCallingLobby();
      return;
    }

    const idForLogging = getConversationIdForLogging(conversation.attributes);
    const logId = `startOutgoingDirectCall(${idForLogging}`;
    log.info(logId);

    if (!this.#reduxInterface) {
      throw new Error(`${logId}: Redux actions not available`);
    }

    const remoteUserId = this.#getRemoteUserIdFromConversation(conversation);
    if (!remoteUserId || !this.#localDeviceId) {
      log.error(`${logId}: Missing identifier, new call not allowed.`);
      this.stopCallingLobby();
      return;
    }

    const haveMediaPermissions = await this.#requestPermissions(hasLocalVideo);
    if (!haveMediaPermissions) {
      log.info(`${logId}: Permissions were denied, new call not allowed.`);
      this.stopCallingLobby();
      return;
    }

    log.info(`${logId}: Getting call settings`);
    // Check state after awaiting to debounce call button.
    if (RingRTC.call && RingRTC.call.state !== CallState.Ended) {
      log.info(`${logId}: Call already in progress, new call not allowed.`);
      this.stopCallingLobby();
      return;
    }

    log.info(`${logId}: Starting in RingRTC`);
    const call = RingRTC.startOutgoingCall(
      remoteUserId,
      hasLocalVideo,
      this.#localDeviceId
    );

    // Send profile key to conversation recipient since call protos don't include it
    if (!conversation.get('profileSharing')) {
      log.info(`${logId}: Setting profileSharing=true`);
      conversation.set({ profileSharing: true });
      await DataWriter.updateConversation(conversation.attributes);
    }
    log.info(`${logId}: Sending profile key`);
    await conversationJobQueue.add({
      conversationId: conversation.id,
      type: 'ProfileKeyForCall',
    });

    RingRTC.setOutgoingAudio(call.callId, hasLocalAudio);
    RingRTC.setVideoCapturer(call.callId, this.#videoCapturer);
    RingRTC.setVideoRenderer(call.callId, this.videoRenderer);
    this.#attachToCall(conversation, call);

    this.#reduxInterface.outgoingCall({
      conversationId: conversation.id,
      hasLocalAudio,
      hasLocalVideo,
    });

    await this.#startDeviceReselectionTimer();
  }

  #getDirectCall(conversationId: string): undefined | Call {
    const call = getOwn(this.#callsLookup, conversationId);
    return call instanceof Call ? call : undefined;
  }

  #getGroupCall(conversationId: string): undefined | GroupCall {
    const call = getOwn(this.#callsLookup, conversationId);
    return call instanceof GroupCall ? call : undefined;
  }

  #getGroupCallMembers(conversationId: string) {
    return getMembershipList(conversationId).map(
      member =>
        new GroupMemberInfo(
          Buffer.from(uuidToBytes(member.aci)),
          Buffer.from(member.uuidCiphertext)
        )
    );
  }

  public setLocalPreviewContainer(container: HTMLDivElement | null): void {
    // Reuse HTMLVideoElement between different containers so that the preview
    // of the last frame stays valid even if there are no new frames on the
    // underlying MediaStream.
    if (this.#localPreview == null) {
      this.#localPreview = document.createElement('video');
      this.#localPreview.autoplay = true;
      this.#videoCapturer.setLocalPreview({ current: this.#localPreview });
    }

    this.#localPreviewContainer?.removeChild(this.#localPreview);
    this.#localPreviewContainer = container;
    this.#localPreviewContainer?.appendChild(this.#localPreview);
  }

  public async cleanupStaleRingingCalls(): Promise<void> {
    const calls = await DataWriter.getRecentStaleRingsAndMarkOlderMissed();

    const results = await Promise.all(
      calls.map(async call => {
        const peekInfo = await this.peekGroupCall(call.peerId);
        return { callId: call.callId, peekInfo };
      })
    );

    const staleCallIds = results
      .filter(result => {
        return result.peekInfo == null;
      })
      .map(result => {
        return result.callId;
      });

    await DataWriter.markCallHistoryMissed(staleCallIds);
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
    const statefulPeekInfo = this.#getGroupCall(conversationId)?.getPeekInfo();
    if (statefulPeekInfo) {
      return statefulPeekInfo;
    }

    if (!this._sfuUrl) {
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
      this._sfuUrl,
      Buffer.from(membershipProof),
      this.#getGroupCallMembers(conversationId)
    );
  }

  public async peekCallLinkCall(
    roomId: string,
    rootKey: string | undefined
  ): Promise<PeekInfo> {
    log.info(`peekCallLinkCall: For roomId ${roomId}`);
    const statefulPeekInfo = this.#getGroupCall(roomId)?.getPeekInfo();
    if (statefulPeekInfo) {
      return statefulPeekInfo;
    }

    if (!rootKey) {
      throw new Error(
        'Missing call link root key, cannot do stateless peeking'
      );
    }

    if (!this._sfuUrl) {
      throw new Error('Missing SFU URL; not peeking call link call');
    }

    const callLinkRootKey = CallLinkRootKey.parse(rootKey);

    const authCredentialPresentation =
      await getCallLinkAuthCredentialPresentation(callLinkRootKey);

    const result = await RingRTC.peekCallLinkCall(
      this._sfuUrl,
      authCredentialPresentation.serialize(),
      callLinkRootKey
    );
    if (!result.success) {
      throw new Error(
        `Failed to peek call link, error ${result.errorStatusCode}, roomId ${roomId}.`
      );
    }

    return result.value;
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
    const existing = this.#getGroupCall(conversationId);
    if (existing) {
      const isExistingCallNotConnected =
        existing.getLocalDeviceState().connectionState ===
        ConnectionState.NotConnected;
      if (isExistingCallNotConnected) {
        existing.connect();
      }
      return existing;
    }

    if (!this._sfuUrl) {
      throw new Error('Missing SFU URL; not connecting group call');
    }

    const groupIdBuffer = Buffer.from(Bytes.fromBase64(groupId));

    let isRequestingMembershipProof = false;

    const outerGroupCall = RingRTC.getGroupCall(
      groupIdBuffer,
      this._sfuUrl,
      Buffer.alloc(0),
      AUDIO_LEVEL_INTERVAL_MS,
      {
        ...this.#getGroupCallObserver(conversationId, CallMode.Group),
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
      }
    );

    if (!outerGroupCall) {
      // This should be very rare, likely due to RingRTC not being able to get a lock
      //   or memory or something like that.
      throw new Error('Failed to get a group call instance; cannot start call');
    }

    outerGroupCall.connect();

    this.#maybeUpdateRtcLogging(outerGroupCall);
    this.#syncGroupCallToRedux(conversationId, outerGroupCall, CallMode.Group);

    return outerGroupCall;
  }

  connectCallLinkCall({
    roomId,
    authCredentialPresentation,
    callLinkRootKey,
    adminPasskey,
  }: {
    roomId: string;
    authCredentialPresentation: CallLinkAuthCredentialPresentation;
    callLinkRootKey: CallLinkRootKey;
    adminPasskey: Buffer | undefined;
  }): GroupCall {
    const existing = this.#getGroupCall(roomId);
    if (existing) {
      const isExistingCallNotConnected =
        existing.getLocalDeviceState().connectionState ===
        ConnectionState.NotConnected;
      if (isExistingCallNotConnected) {
        existing.connect();
      }
      return existing;
    }

    if (!this._sfuUrl) {
      throw new Error('Missing SFU URL; not connecting group call link call');
    }

    const outerGroupCall = RingRTC.getCallLinkCall(
      this._sfuUrl,
      authCredentialPresentation.serialize(),
      callLinkRootKey,
      adminPasskey,
      Buffer.alloc(0),
      AUDIO_LEVEL_INTERVAL_MS,
      this.#getGroupCallObserver(roomId, CallMode.Adhoc)
    );

    if (!outerGroupCall) {
      // This should be very rare, likely due to RingRTC not being able to get a lock
      //   or memory or something like that.
      throw new Error('Failed to get a group call instance; cannot start call');
    }

    outerGroupCall.connect();

    this.#maybeUpdateRtcLogging(outerGroupCall);
    this.#syncGroupCallToRedux(roomId, outerGroupCall, CallMode.Adhoc);

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

    const logId = `joinGroupCall(${getConversationIdForLogging(conversation)})`;
    log.info(logId);

    if (
      !conversation.groupId ||
      !conversation.publicParams ||
      !conversation.secretParams
    ) {
      log.error(
        `${logId}: Conversation is missing required parameters. Cannot join group call`
      );
      return;
    }

    const haveMediaPermissions = await this.#requestPermissions(hasLocalVideo);
    if (!haveMediaPermissions) {
      log.info(
        `${logId}: Permissions were denied, but allow joining group call`
      );
    }

    await this.#startDeviceReselectionTimer();

    const groupCall = this.connectGroupCall(conversationId, {
      groupId: conversation.groupId,
      publicParams: conversation.publicParams,
      secretParams: conversation.secretParams,
    });

    groupCall.setOutgoingAudioMuted(!hasLocalAudio);
    groupCall.setOutgoingVideoMuted(!hasLocalVideo);
    drop(this.enableCaptureAndSend(groupCall, null, logId));

    if (shouldRing) {
      groupCall.ringAll();
    }

    log.info(`${logId}: Joining in RingRTC`);
    groupCall.join();
  }

  #getGroupCallObserver(
    conversationId: string,
    callMode: CallMode.Group | CallMode.Adhoc
  ): GroupCallObserver {
    let updateMessageState = GroupCallUpdateMessageState.SentNothing;
    const updateCallHistoryOnLocalChanged =
      callMode === CallMode.Group
        ? this.updateCallHistoryForGroupCallOnLocalChanged.bind(this)
        : this.updateCallHistoryForAdhocCall.bind(this);
    const updateCallHistoryOnPeek =
      callMode === CallMode.Group
        ? this.updateCallHistoryForGroupCallOnPeek.bind(this)
        : this.updateCallHistoryForAdhocCall.bind(this);
    const logId =
      callMode === CallMode.Group
        ? `groupv2(${conversationId})`
        : `adhoc(${conversationId})`;

    return {
      onLocalDeviceStateChanged: groupCall => {
        const localDeviceState = groupCall.getLocalDeviceState();
        const peekInfo = groupCall.getPeekInfo() ?? null;
        const { eraId } = peekInfo ?? {};

        log.info(
          'GroupCall#onLocalDeviceStateChanged',
          formatLocalDeviceState(localDeviceState),
          peekInfo != null ? formatPeekInfo(peekInfo) : '(No PeekInfo)'
        );

        // For adhoc calls, conversationId will be a roomId
        drop(
          updateCallHistoryOnLocalChanged(
            conversationId,
            convertJoinState(localDeviceState.joinState),
            peekInfo
          )
        );

        if (localDeviceState.connectionState === ConnectionState.NotConnected) {
          // NOTE: This assumes that only one call is active at a time. For example, if
          //   there are two calls using the camera, this will disable both of them.
          //   That's fine for now, but this will break if that assumption changes.
          this.disableLocalVideo();

          delete this.#callsLookup[conversationId];

          if (
            updateMessageState === GroupCallUpdateMessageState.SentJoin &&
            eraId
          ) {
            updateMessageState = GroupCallUpdateMessageState.SentLeft;
            if (callMode === CallMode.Group) {
              drop(this.#sendGroupCallUpdateMessage(conversationId, eraId));
            }
          }
        } else {
          this.#callsLookup[conversationId] = groupCall;

          // NOTE: This assumes only one active call at a time. See comment above.
          if (localDeviceState.videoMuted) {
            this.disableLocalVideo();
          } else {
            drop(this.enableCaptureAndSend(groupCall, null, logId));
          }

          // Call enters the Joined state, once per call.
          // This can also happen in onPeekChanged.
          if (
            updateMessageState === GroupCallUpdateMessageState.SentNothing &&
            localDeviceState.joinState === JoinState.Joined &&
            eraId
          ) {
            updateMessageState = GroupCallUpdateMessageState.SentJoin;
            drop(
              this.#onGroupCallJoined({
                peerId: conversationId,
                eraId,
                callMode,
                peekInfo,
              })
            );
          }
        }

        this.#syncGroupCallToRedux(conversationId, groupCall, callMode);
      },
      onRemoteDeviceStatesChanged: groupCall => {
        const localDeviceState = groupCall.getLocalDeviceState();
        const peekInfo = groupCall.getPeekInfo();

        log.info(
          'GroupCall#onRemoteDeviceStatesChanged',
          formatLocalDeviceState(localDeviceState),
          peekInfo ? formatPeekInfo(peekInfo) : '(No PeekInfo)'
        );

        this.#syncGroupCallToRedux(conversationId, groupCall, callMode);
        if (callMode === CallMode.Adhoc) {
          drop(
            this.#sendProfileKeysForAdhocCall({
              roomId: conversationId,
              peekInfo,
            })
          );
        }
      },
      onAudioLevels: groupCall => {
        const remoteDeviceStates = groupCall.getRemoteDeviceStates();
        if (!remoteDeviceStates) {
          return;
        }
        const localAudioLevel = groupCall.getLocalDeviceState().audioLevel;

        this.#reduxInterface?.groupCallAudioLevelsChange({
          callMode,
          conversationId,
          localAudioLevel,
          remoteDeviceStates,
        });
      },
      onLowBandwidthForVideo: (_groupCall, _recovered) => {
        // TODO: Implement handling of "low outgoing bandwidth for video" notification.
      },

      /**
       * @param reactions A list of reactions received by the client ordered
       * from oldest to newest.
       */
      onReactions: (_groupCall, reactions) => {
        this.#reduxInterface?.receiveGroupCallReactions({
          callMode,
          conversationId,
          reactions,
        });
      },
      onRaisedHands: (_groupCall, raisedHands) => {
        this.#reduxInterface?.groupCallRaisedHandsChange({
          callMode,
          conversationId,
          raisedHands,
        });
      },
      onPeekChanged: groupCall => {
        const localDeviceState = groupCall.getLocalDeviceState();
        const peekInfo = groupCall.getPeekInfo() ?? null;
        const { eraId } = peekInfo ?? {};

        log.info(
          'GroupCall#onPeekChanged',
          formatLocalDeviceState(localDeviceState),
          peekInfo ? formatPeekInfo(peekInfo) : '(No PeekInfo)'
        );

        // Call enters the Joined state, once per call.
        // This can also happen in onLocalDeviceStateChanged.
        if (
          updateMessageState === GroupCallUpdateMessageState.SentNothing &&
          localDeviceState.connectionState !== ConnectionState.NotConnected &&
          localDeviceState.joinState === JoinState.Joined &&
          eraId
        ) {
          updateMessageState = GroupCallUpdateMessageState.SentJoin;
          drop(
            this.#onGroupCallJoined({
              peerId: conversationId,
              eraId,
              callMode,
              peekInfo,
            })
          );
        }

        // For adhoc calls, conversationId will be a roomId
        drop(
          updateCallHistoryOnPeek(
            conversationId,
            convertJoinState(localDeviceState.joinState),
            peekInfo
          )
        );

        this.#syncGroupCallToRedux(conversationId, groupCall, callMode);
      },
      async requestMembershipProof(_groupCall) {
        log.error('GroupCall#requestMembershipProof not implemented.');
      },
      requestGroupMembers: groupCall => {
        groupCall.setGroupMembers(this.#getGroupCallMembers(conversationId));
      },
      onEnded: (groupCall, endedReason) => {
        const localDeviceState = groupCall.getLocalDeviceState();
        const peekInfo = groupCall.getPeekInfo();

        log.info(
          'GroupCall#onEnded',
          endedReason,
          formatLocalDeviceState(localDeviceState),
          peekInfo ? formatPeekInfo(peekInfo) : '(No PeekInfo)'
        );

        this.#reduxInterface?.groupCallEnded({
          conversationId,
          endedReason,
        });
      },
      onSpeechEvent: (_groupCall: GroupCall, event: SpeechEvent) => {
        if (!isLowerHandSuggestionEnabled()) {
          return;
        }
        log.info('GroupCall#onSpeechEvent', event);
        if (event === SpeechEvent.LowerHandSuggestion) {
          this.#reduxInterface?.setSuggestLowerHand(true);
        } else if (event === SpeechEvent.StoppedSpeaking) {
          this.#reduxInterface?.setSuggestLowerHand(false);
        } else {
          log.error(
            'GroupCall#onSpeechEvent, unknown speechEvent',
            SpeechEvent,
            Errors.toLogFormat(missingCaseError(event))
          );
        }
      },
    };
  }

  async #onGroupCallJoined({
    callMode,
    peerId,
    eraId,
    peekInfo,
  }: {
    callMode: CallMode.Group | CallMode.Adhoc;
    peerId: string;
    eraId: string;
    peekInfo: PeekInfo | null;
  }): Promise<void> {
    if (callMode === CallMode.Group) {
      drop(this.#sendGroupCallUpdateMessage(peerId, eraId));
    } else if (callMode === CallMode.Adhoc) {
      this.#reduxInterface?.joinedAdhocCall(peerId);
      drop(this.#sendProfileKeysForAdhocCall({ roomId: peerId, peekInfo }));
    }
  }

  async #sendProfileKeysForAdhocCall({
    roomId,
    peekInfo,
  }: {
    roomId: string;
    peekInfo: PeekInfo | null | undefined;
  }): Promise<void> {
    if (!peekInfo) {
      return;
    }

    const ourAci = window.textsecure.storage.user.getCheckedAci();
    const reason = `sendProfileKeysForAdhocCall(${roomId})`;
    peekInfo.devices.forEach(async device => {
      const aci = device.userId ? this.#formatUserId(device.userId) : null;
      if (
        !aci ||
        aci === ourAci ||
        this.#sendProfileKeysForAdhocCallCache.has(aci)
      ) {
        return;
      }

      const logId = `sendProfileKeysForAdhocCall aci=${aci}`;
      const conversation = window.ConversationController.lookupOrCreate({
        serviceId: aci,
        reason,
      });
      if (!conversation) {
        log.warn(`${logId}: Could not lookup or create conversation for aci`);
        return;
      }

      if (conversation.isBlocked()) {
        log.info(`${logId}: Skipping blocked aci`);
        return;
      }

      log.info(`${logId}: Sending profile key`);
      drop(
        conversationJobQueue.add({
          type: conversationQueueJobEnum.enum.ProfileKeyForCall,
          conversationId: conversation.id,
          isOneTimeSend: true,
        })
      );
      this.#sendProfileKeysForAdhocCallCache.add(aci);
    });
  }

  public async joinCallLinkCall({
    roomId,
    rootKey,
    adminKey,
    hasLocalAudio,
    hasLocalVideo,
  }: {
    roomId: string;
    rootKey: string;
    adminKey: string | undefined;
    hasLocalAudio: boolean;
    hasLocalVideo: boolean;
  }): Promise<void> {
    const logId = `joinCallLinkCall(${roomId})`;
    log.info(logId);

    const haveMediaPermissions = await this.#requestPermissions(hasLocalVideo);
    if (!haveMediaPermissions) {
      log.info(
        `${logId}: Permissions were denied, but allow joining call link call`
      );
    }

    await this.#startDeviceReselectionTimer();

    const callLinkRootKey = CallLinkRootKey.parse(rootKey);
    const authCredentialPresentation =
      await getCallLinkAuthCredentialPresentation(callLinkRootKey);
    const adminPasskey = adminKey ? toAdminKeyBytes(adminKey) : undefined;

    // RingRTC reuses the same type GroupCall between Adhoc and Group calls.
    const groupCall = this.connectCallLinkCall({
      roomId,
      authCredentialPresentation,
      callLinkRootKey,
      adminPasskey,
    });

    groupCall.setOutgoingAudioMuted(!hasLocalAudio);
    groupCall.setOutgoingVideoMuted(!hasLocalVideo);
    drop(this.enableCaptureAndSend(groupCall));

    log.info(`${logId}: Joining in RingRTC`);
    groupCall.join();
  }

  #getCallIdForConversation(conversationId: string): undefined | CallId {
    return this.#getDirectCall(conversationId)?.callId;
  }

  public setGroupCallVideoRequest(
    conversationId: string,
    resolutions: Array<VideoRequest>,
    speakerHeight: number
  ): void {
    this.#getGroupCall(conversationId)?.requestVideo(
      resolutions,
      speakerHeight
    );
  }

  public groupMembersChanged(conversationId: string): void {
    // This will be called for any conversation change, so it's likely that there won't
    //   be a group call available; that's fine.
    const groupCall = this.#getGroupCall(conversationId);
    if (!groupCall) {
      return;
    }

    groupCall.setGroupMembers(this.#getGroupCallMembers(conversationId));
  }

  public approveUser(conversationId: string, aci: AciString): void {
    const groupCall = this.#getGroupCall(conversationId);
    if (!groupCall) {
      throw new Error('Could not find matching call');
    }

    groupCall.approveUser(Buffer.from(uuidToBytes(aci)));
  }

  public denyUser(conversationId: string, aci: AciString): void {
    const groupCall = this.#getGroupCall(conversationId);
    if (!groupCall) {
      throw new Error('Could not find matching call');
    }

    groupCall.denyUser(Buffer.from(uuidToBytes(aci)));
  }

  public removeClient(conversationId: string, demuxId: number): void {
    const groupCall = this.#getGroupCall(conversationId);
    if (!groupCall) {
      throw new Error('Could not find matching call');
    }

    groupCall.removeClient(demuxId);
  }

  public blockClient(conversationId: string, demuxId: number): void {
    const groupCall = this.#getGroupCall(conversationId);
    if (!groupCall) {
      throw new Error('Could not find matching call');
    }

    groupCall.blockClient(demuxId);
  }

  // See the comment in types/Calling.ts to explain why we have to do this conversion.
  #convertRingRtcConnectionState(
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
  #convertRingRtcJoinState(joinState: JoinState): GroupCallJoinState {
    switch (joinState) {
      case JoinState.NotJoined:
        return GroupCallJoinState.NotJoined;
      case JoinState.Joining:
        return GroupCallJoinState.Joining;
      case JoinState.Pending:
        return GroupCallJoinState.Pending;
      case JoinState.Joined:
        return GroupCallJoinState.Joined;
      default:
        throw missingCaseError(joinState);
    }
  }

  #formatUserId(userId: Buffer): AciString | null {
    const uuid = bytesToUuid(userId);
    if (uuid && isAciString(uuid)) {
      return uuid;
    }

    log.error(
      'Calling.formatUserId: could not convert participant UUID Uint8Array to string'
    );
    return null;
  }

  public formatGroupCallPeekInfoForRedux(
    peekInfo: PeekInfo
  ): GroupCallPeekInfoType {
    const creatorAci = peekInfo.creator && bytesToUuid(peekInfo.creator);
    return {
      acis: peekInfo.devices.map(peekDeviceInfo => {
        if (peekDeviceInfo.userId) {
          const uuid = this.#formatUserId(peekDeviceInfo.userId);
          if (uuid) {
            return uuid;
          }
        } else {
          log.error(
            'Calling.formatGroupCallPeekInfoForRedux: device had no user ID; using fallback UUID'
          );
        }
        return normalizeAci(
          '00000000-0000-4000-8000-000000000000',
          'formatGrouPCallPeekInfoForRedux'
        );
      }),
      pendingAcis: compact(
        peekInfo.pendingUsers.map(userId => this.#formatUserId(userId))
      ),
      creatorAci:
        creatorAci !== undefined
          ? normalizeAci(
              creatorAci,
              'formatGroupCallPeekInfoForRedux.creatorAci'
            )
          : undefined,
      eraId: peekInfo.eraId,
      maxDevices: peekInfo.maxDevices ?? Infinity,
      deviceCount: peekInfo.deviceCount,
    };
  }

  #formatGroupCallForRedux(groupCall: GroupCall) {
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
        : this.#convertRingRtcJoinState(localDeviceState.joinState);

    return {
      connectionState: this.#convertRingRtcConnectionState(
        localDeviceState.connectionState
      ),
      joinState,
      hasLocalAudio: !localDeviceState.audioMuted,
      hasLocalVideo: !localDeviceState.videoMuted,
      localDemuxId: localDeviceState.demuxId,
      peekInfo: peekInfo
        ? this.formatGroupCallPeekInfoForRedux(peekInfo)
        : undefined,
      remoteParticipants: remoteDeviceStates.map(remoteDeviceState => {
        let aci = bytesToUuid(remoteDeviceState.userId);
        if (!aci) {
          log.error(
            'Calling.formatGroupCallForRedux: could not convert remote participant UUID Uint8Array to string; using fallback UUID'
          );
          aci = '00000000-0000-4000-8000-000000000000';
        }
        assertDev(isAciString(aci), 'remote participant aci must be a aci');

        return {
          aci,
          addedTime: normalizeGroupCallTimestamp(remoteDeviceState.addedTime),
          demuxId: remoteDeviceState.demuxId,
          hasRemoteAudio: !remoteDeviceState.audioMuted,
          hasRemoteVideo: !remoteDeviceState.videoMuted,
          mediaKeysReceived: remoteDeviceState.mediaKeysReceived,
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
    const groupCall = this.#getGroupCall(conversationId);
    if (!groupCall) {
      throw new Error('Could not find matching call');
    }
    return groupCall.getVideoSource(demuxId);
  }

  public resendGroupCallMediaKeys(conversationId: string): void {
    const groupCall = this.#getGroupCall(conversationId);
    if (!groupCall) {
      throw new Error('Could not find matching call');
    }
    groupCall.resendMediaKeys();
  }

  public sendGroupCallRaiseHand(conversationId: string, raise: boolean): void {
    const groupCall = this.#getGroupCall(conversationId);
    if (!groupCall) {
      throw new Error('Could not find matching call');
    }
    groupCall.raiseHand(raise);
  }

  public sendGroupCallReaction(conversationId: string, value: string): void {
    const groupCall = this.#getGroupCall(conversationId);
    if (!groupCall) {
      throw new Error('Could not find matching call');
    }
    groupCall.react(value);
  }

  // configures how often call stats are computed
  public setAllRtcStatsInterval(intervalMillis: number | null): void {
    if (this.#currentRtcStatsInterval === intervalMillis) {
      return;
    }
    this.#currentRtcStatsInterval = intervalMillis;

    // GroupCall.setRtcStatsInterval resets to the default when interval == 0
    // so set it to 0 when intervalMillis is undefined
    const statsInterval = intervalMillis ?? 0;

    for (const conversationId of Object.keys(this.#callsLookup)) {
      const groupCall = this.#getGroupCall(conversationId);
      if (!groupCall) {
        continue;
      }
      log.info('Setting rtc stats interval:', conversationId, statsInterval);
      groupCall.setRtcStatsInterval(statsInterval);
    }
  }

  #syncGroupCallToRedux(
    conversationId: string,
    groupCall: GroupCall,
    callMode: CallMode.Group | CallMode.Adhoc
  ): void {
    this.#reduxInterface?.groupCallStateChange({
      conversationId,
      callMode,
      ...this.#formatGroupCallForRedux(groupCall),
    });
  }

  // Used specifically to send updates about in-progress group calls, nothing else
  async #sendGroupCallUpdateMessage(
    conversationId: string,
    eraId: string
  ): Promise<boolean> {
    const conversation = window.ConversationController.get(conversationId);
    if (!conversation) {
      log.error('sendGroupCallUpdateMessage: Conversation not found!');
      return false;
    }

    const logId = `sendGroupCallUpdateMessage/${conversation.idForLogging()}`;

    const groupV2 = conversation.getGroupV2Info();
    if (!groupV2) {
      log.error(`${logId}: Conversation lacks groupV2 info!`);
      return false;
    }

    try {
      await conversationJobQueue.add({
        type: 'GroupCallUpdate',
        conversationId: conversation.id,
        eraId,
        urgent: true,
      });
      return true;
    } catch (err) {
      log.error(
        `${logId}: Failed to queue call update:`,
        Errors.toLogFormat(err)
      );
      return false;
    }
  }

  async acceptDirectCall(
    conversationId: string,
    asVideoCall: boolean
  ): Promise<void> {
    log.info('CallingClass.acceptDirectCall()');

    const callId = this.#getCallIdForConversation(conversationId);
    if (!callId) {
      log.warn('Trying to accept a non-existent call');
      return;
    }

    const haveMediaPermissions = await this.#requestPermissions(asVideoCall);
    if (haveMediaPermissions) {
      await this.#startDeviceReselectionTimer();
      RingRTC.setVideoCapturer(callId, this.#videoCapturer);
      RingRTC.setVideoRenderer(callId, this.videoRenderer);
      RingRTC.accept(callId, asVideoCall);
    } else {
      log.info('Permissions were denied, call not allowed, hanging up.');
      RingRTC.hangup(callId);
    }
  }

  declineDirectCall(conversationId: string): void {
    log.info('CallingClass.declineDirectCall()');

    const callId = this.#getCallIdForConversation(conversationId);
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

  hangup(conversationId: string, reason: string): void {
    log.info(`CallingClass.hangup(${conversationId}): ${reason}`);

    const specificCall = getOwn(this.#callsLookup, conversationId);
    if (!specificCall) {
      log.error(
        `hangup: Trying to hang up a non-existent call for conversation ${conversationId}`
      );
    }

    ipcRenderer.send(
      'screen-share:status-change',
      ScreenShareStatus.Disconnected
    );

    const entries = Object.entries(this.#callsLookup);
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

  hangupAllCalls(reason: string): void {
    const conversationIds = Object.keys(this.#callsLookup);
    for (const conversationId of conversationIds) {
      this.hangup(conversationId, reason);
    }
  }

  setOutgoingAudio(conversationId: string, enabled: boolean): void {
    const call = getOwn(this.#callsLookup, conversationId);
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
    const call = getOwn(this.#callsLookup, conversationId);
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

  #setOutgoingVideoIsScreenShare(
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

  async setPresenting({
    conversationId,
    hasLocalVideo,
    mediaStream,
    source,
    callLinkRootKey,
  }: SetPresentingOptionsType): Promise<void> {
    const call = getOwn(this.#callsLookup, conversationId);
    if (!call) {
      log.warn('Trying to set presenting for a non-existent call');
      return;
    }

    this.#videoCapturer.disable();
    const isPresenting = mediaStream != null;
    if (isPresenting) {
      this.#hadLocalVideoBeforePresenting = hasLocalVideo;
      drop(
        this.enableCaptureAndSend(call, {
          maxFramerate: REQUESTED_SCREEN_SHARE_FRAMERATE,
          maxHeight: REQUESTED_SCREEN_SHARE_HEIGHT,
          maxWidth: REQUESTED_SCREEN_SHARE_WIDTH,
          mediaStream,
          onEnded: () => {
            this.#reduxInterface?.cancelPresenting();
          },
        })
      );
      this.setOutgoingVideo(conversationId, true);
    } else {
      this.setOutgoingVideo(
        conversationId,
        this.#hadLocalVideoBeforePresenting ?? hasLocalVideo
      );
      this.#hadLocalVideoBeforePresenting = undefined;
    }

    this.#setOutgoingVideoIsScreenShare(call, isPresenting);

    if (isPresenting) {
      ipcRenderer.send('show-screen-share', source?.name);

      let url: string;
      let absolutePath: string | undefined;

      if (
        call instanceof GroupCall &&
        call.getKind() === GroupCallKind.CallLink
      ) {
        strictAssert(callLinkRootKey, 'If call is adhoc, we need rootKey');
        const color = getColorForCallLink(callLinkRootKey);
        const saveToDisk = shouldSaveNotificationAvatarToDisk();
        const result = await createIdenticon(
          color,
          { type: 'call-link' },
          { saveToDisk }
        );
        url = result.url;
        absolutePath = result.path
          ? window.Signal.Migrations.getAbsoluteTempPath(result.path)
          : undefined;
      } else {
        const conversation = window.ConversationController.get(conversationId);
        strictAssert(conversation, 'setPresenting: conversation not found');

        const result = await conversation.getAvatarOrIdenticon();
        url = result.url;
        absolutePath = result.absolutePath;
      }

      notificationService.notify({
        conversationId,
        iconPath: absolutePath,
        iconUrl: url,
        message: window.i18n('icu:calling__presenting--notification-body'),
        type: NotificationType.IsPresenting,
        sentAt: 0,
        silent: true,
        title: window.i18n('icu:calling__presenting--notification-title'),
      });
    } else {
      ipcRenderer.send(
        'screen-share:status-change',
        ScreenShareStatus.Disconnected
      );
    }
  }

  async notifyScreenShareStatus(
    options: NotifyScreenShareStatusOptionsType
  ): Promise<void> {
    let newStatus: ScreenShareStatus;
    if (options.callMode === CallMode.Direct) {
      switch (options.callState) {
        case CallState.Prering:
        case CallState.Ringing:
        case CallState.Accepted:
          newStatus = ScreenShareStatus.Connected;
          break;
        case CallState.Reconnecting:
          newStatus = ScreenShareStatus.Reconnecting;
          break;
        case CallState.Ended:
          newStatus = ScreenShareStatus.Disconnected;
          break;
        default:
          throw missingCaseError(options.callState);
      }
    } else {
      switch (options.connectionState) {
        case GroupCallConnectionState.NotConnected:
          newStatus = ScreenShareStatus.Disconnected;
          break;
        case GroupCallConnectionState.Connecting:
        case GroupCallConnectionState.Connected:
          newStatus = ScreenShareStatus.Connected;
          break;
        case GroupCallConnectionState.Reconnecting:
          newStatus = ScreenShareStatus.Reconnecting;
          break;
        default:
          throw missingCaseError(options.connectionState);
      }
    }

    const { conversationId, isPresenting } = options;

    if (
      options.callMode !== CallMode.Adhoc &&
      isPresenting &&
      conversationId &&
      newStatus === ScreenShareStatus.Reconnecting
    ) {
      const conversation = window.ConversationController.get(conversationId);
      strictAssert(
        conversation,
        'showPresentingReconnectingNotification: conversation not found'
      );

      const { url, absolutePath } = await conversation.getAvatarOrIdenticon();

      notificationService.notify({
        conversationId,
        iconPath: absolutePath,
        iconUrl: url,
        message: window.i18n(
          'icu:calling__presenting--reconnecting--notification-body'
        ),
        type: NotificationType.IsPresenting,
        sentAt: 0,
        silent: true,
        title: window.i18n(
          'icu:calling__presenting--reconnecting--notification-title'
        ),
      });
    }
    ipcRenderer.send('screen-share:status-change', newStatus);
  }

  async #startDeviceReselectionTimer(): Promise<void> {
    // Poll once
    await this.#pollForMediaDevices();
    // Start the timer
    if (!this.#deviceReselectionTimer) {
      this.#deviceReselectionTimer = setInterval(async () => {
        await this.#pollForMediaDevices();
      }, 3000);
    }
  }

  #stopDeviceReselectionTimer() {
    clearTimeoutIfNecessary(this.#deviceReselectionTimer);
    this.#deviceReselectionTimer = undefined;
  }

  #mediaDeviceSettingsEqual(
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

  async #pollForMediaDevices(): Promise<void> {
    const newSettings = await this.getMediaDeviceSettings();
    if (
      !this.#mediaDeviceSettingsEqual(
        this.#lastMediaDeviceSettings,
        newSettings
      )
    ) {
      log.info(
        'MediaDevice: available devices changed (from->to)',
        cleanForLogging(this.#lastMediaDeviceSettings),
        cleanForLogging(newSettings)
      );

      await this.#selectPreferredDevices(newSettings);
      this.#lastMediaDeviceSettings = newSettings;
      this.#reduxInterface?.refreshIODevices(newSettings);
    }
  }

  async getAvailableIODevices(): Promise<AvailableIODevicesType> {
    const availableCameras = await this.#videoCapturer.enumerateDevices();
    const availableMicrophones = RingRTC.getAudioInputs();
    const availableSpeakers = RingRTC.getAudioOutputs();

    return {
      availableCameras,
      availableMicrophones,
      availableSpeakers,
    };
  }

  async getMediaDeviceSettings(): Promise<MediaDeviceSettings> {
    const { availableCameras, availableMicrophones, availableSpeakers } =
      await this.getAvailableIODevices();

    const preferredMicrophone = window.Events.getPreferredAudioInputDevice();
    const selectedMicIndex = findBestMatchingAudioDeviceIndex(
      {
        available: availableMicrophones,
        preferred: preferredMicrophone,
      },
      OS.isWindows()
    );
    const selectedMicrophone =
      selectedMicIndex !== undefined
        ? availableMicrophones[selectedMicIndex]
        : undefined;

    const preferredSpeaker = window.Events.getPreferredAudioOutputDevice();
    const selectedSpeakerIndex = findBestMatchingAudioDeviceIndex(
      {
        available: availableSpeakers,
        preferred: preferredSpeaker,
      },
      OS.isWindows()
    );
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
    log.info(
      'MediaDevice: setPreferredMicrophone',
      device.index,
      truncateForLogging(device.name)
    );
    void window.Events.setPreferredAudioInputDevice(device);
    RingRTC.setAudioInput(device.index);
  }

  setPreferredSpeaker(device: AudioDevice): void {
    log.info(
      'MediaDevice: setPreferredSpeaker',
      device.index,
      truncateForLogging(device.name)
    );
    void window.Events.setPreferredAudioOutputDevice(device);
    RingRTC.setAudioOutput(device.index);
  }

  enableLocalCamera(): void {
    drop(this.#videoCapturer.enableCapture());
  }

  async enableCaptureAndSend(
    call: GroupCall | Call,
    options?: GumVideoCaptureOptions | null,
    logId?: string
  ): Promise<void> {
    try {
      await this.#videoCapturer.enableCaptureAndSend(
        call,
        options ?? undefined
      );
    } catch (err) {
      log.error(
        `${
          logId ?? 'enableCaptureAndSend'
        }: Failed to enable camera and start sending:`,
        Errors.toLogFormat(err)
      );
    }
  }

  disableLocalVideo(): void {
    this.#videoCapturer.disable();
  }

  async setPreferredCamera(device: string): Promise<void> {
    log.info('MediaDevice: setPreferredCamera', device);
    void window.Events.setPreferredVideoInputDevice(device);
    await this.#videoCapturer.setPreferredDevice(device);
  }

  async handleCallingMessage(
    envelope: ProcessedEnvelope,
    callingMessage: Proto.ICallMessage
  ): Promise<void> {
    const logId = `CallingClass.handleCallingMessage(${envelope.timestamp})`;

    const enableIncomingCalls = window.Events.getIncomingCallNotification();
    if (callingMessage.offer && !enableIncomingCalls) {
      // Drop offers silently if incoming call notifications are disabled.
      log.info(`${logId}: Incoming calls are disabled, ignoring call offer.`);
      return;
    }

    const remoteUserId = envelope.sourceServiceId;
    const remoteDeviceId = this.#parseDeviceId(envelope.sourceDevice);
    if (!remoteUserId || !remoteDeviceId || !this.#localDeviceId) {
      log.error(`${logId}: Missing identifier, ignoring call message.`);
      return;
    }

    const { storage } = window.textsecure;

    const senderIdentityRecord =
      await storage.protocol.getOrMigrateIdentityRecord(remoteUserId);
    if (!senderIdentityRecord) {
      log.error(
        `${logId}: Missing sender identity record; ignoring call message.`
      );
      return;
    }
    const senderIdentityKey = senderIdentityRecord.publicKey.slice(1); // Ignore the type header, it is not used.

    const ourAci = storage.user.getCheckedAci();

    const receiverIdentityRecord = storage.protocol.getIdentityRecord(ourAci);
    if (!receiverIdentityRecord) {
      log.error(
        `${logId}: Missing receiver identity record; ignoring call message.`
      );
      return;
    }
    const receiverIdentityKey = receiverIdentityRecord.publicKey.slice(1); // Ignore the type header, it is not used.

    const conversation = window.ConversationController.get(remoteUserId);
    if (!conversation) {
      log.error(`${logId}: Missing conversation; ignoring call message.`);
      return;
    }

    if (
      callingMessage.offer &&
      !conversation.getAccepted({ ignoreEmptyConvo: true })
    ) {
      log.info(
        `${logId}: Conversation was not approved by user; ` +
          'rejecting call message.'
      );

      const { id: callId } = callingMessage.offer;
      assertDev(callId != null, 'Call ID missing from offer');

      const hangup = new HangupMessage(
        callId,
        HangupType.NeedPermission,
        remoteDeviceId
      );

      const message = new CallingMessage();
      message.hangup = hangup;

      await this.#handleOutgoingSignaling(remoteUserId, message);

      const wasVideoCall =
        callingMessage.offer.type ===
        Proto.CallMessage.Offer.Type.OFFER_VIDEO_CALL;

      const peerId = getPeerIdFromConversation(conversation.attributes);
      const callDetails = getCallDetailsFromEndedDirectCall(
        callId.toString(),
        peerId,
        remoteUserId, // Incoming call
        wasVideoCall,
        envelope.timestamp
      );
      const localCallEvent = LocalCallEvent.Missed;
      const callEvent = getCallEventDetails(
        callDetails,
        localCallEvent,
        'CallingClass.handleCallingMessage'
      );
      await updateCallHistoryFromLocalEvent(
        callEvent,
        envelope.receivedAtCounter,
        envelope.receivedAtDate
      );

      return;
    }

    const sourceServiceId = envelope.sourceServiceId
      ? uuidToBytes(envelope.sourceServiceId)
      : null;

    const messageAgeSec = envelope.messageAgeSec ? envelope.messageAgeSec : 0;

    log.info(`${logId}: Handling in RingRTC`);

    RingRTC.handleCallingMessage(protoToCallingMessage(callingMessage), {
      remoteUserId,
      remoteUuid: sourceServiceId ? Buffer.from(sourceServiceId) : undefined,
      remoteDeviceId,
      localDeviceId: this.#localDeviceId,
      ageSec: messageAgeSec,
      receivedAtCounter: envelope.receivedAtCounter,
      receivedAtDate: envelope.receivedAtDate,
      senderIdentityKey: Buffer.from(senderIdentityKey),
      receiverIdentityKey: Buffer.from(receiverIdentityKey),
    });
  }

  async #selectPreferredDevices(settings: MediaDeviceSettings): Promise<void> {
    if (
      (!this.#lastMediaDeviceSettings && settings.selectedCamera) ||
      (this.#lastMediaDeviceSettings &&
        settings.selectedCamera &&
        this.#lastMediaDeviceSettings.selectedCamera !==
          settings.selectedCamera)
    ) {
      log.info('MediaDevice: selecting camera', settings.selectedCamera);
      await this.#videoCapturer.setPreferredDevice(settings.selectedCamera);
    }

    // Assume that the MediaDeviceSettings have been obtained very recently and
    // the index is still valid (no devices have been plugged in in between).
    if (settings.selectedMicrophone) {
      log.info(
        'MediaDevice: selecting microphone',
        settings.selectedMicrophone.index,
        truncateForLogging(settings.selectedMicrophone.name)
      );
      RingRTC.setAudioInput(settings.selectedMicrophone.index);
    }

    if (settings.selectedSpeaker) {
      log.info(
        'MediaDevice: selecting speaker',
        settings.selectedSpeaker.index,
        truncateForLogging(settings.selectedSpeaker.name)
      );
      RingRTC.setAudioOutput(settings.selectedSpeaker.index);
    }
  }

  async #requestCameraPermissions(): Promise<boolean> {
    const cameraPermission = await window.IPC.getMediaCameraPermissions();
    if (!cameraPermission) {
      await window.IPC.showPermissionsPopup(true, true);

      // Check the setting again (from the source of truth).
      return window.IPC.getMediaCameraPermissions();
    }

    return true;
  }

  async #requestPermissions(isVideoCall: boolean): Promise<boolean> {
    const microphonePermission = await requestMicrophonePermissions(true);
    if (microphonePermission) {
      if (isVideoCall) {
        return this.#requestCameraPermissions();
      }

      return true;
    }

    return false;
  }

  async #handleSendCallMessage(
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
    return this.#handleOutgoingSignaling(userId, message, urgency);
  }

  // Used to send a variety of group call messages, including the initial call message
  async #handleSendCallMessageToGroup(
    groupIdBytes: Buffer,
    data: Buffer,
    urgency: CallMessageUrgency,
    overrideRecipients: Array<Buffer> = []
  ): Promise<boolean> {
    const groupId = groupIdBytes.toString('base64');
    const conversation = window.ConversationController.get(groupId);
    if (!conversation) {
      log.error('handleSendCallMessageToGroup(): could not find conversation');
      return false;
    }

    // If this message isn't droppable, we'll wake up recipient devices. The important one
    //   is the first message to start the call.
    const urgent = urgency === CallMessageUrgency.HandleImmediately;

    try {
      let recipients: Array<ServiceIdString> = [];
      let isPartialSend = false;
      if (overrideRecipients.length > 0) {
        // Send only to the overriding recipients.
        overrideRecipients.forEach(recipient => {
          const serviceId = bytesToUuid(recipient);
          if (!serviceId) {
            log.error(
              'handleSendCallMessageToGroup(): missing recipient serviceId'
            );
          } else {
            assertDev(
              isServiceIdString(serviceId),
              'remoteServiceId is not a serviceId'
            );
            recipients.push(serviceId);
          }
        });
        isPartialSend = true;
      } else {
        // Send to all members in the group.
        recipients = conversation.getRecipients();
      }

      const callingMessage = new CallingMessage();
      callingMessage.opaque = new OpaqueMessage();
      callingMessage.opaque.data = data;

      const proto = callingMessageToProto(callingMessage, urgency);
      const protoBytes = Proto.CallMessage.encode(proto).finish();
      const protoBase64 = Bytes.toBase64(protoBytes);

      await conversationJobQueue.add({
        type: 'CallingMessage',
        conversationId: conversation.id,
        protoBase64,
        urgent,
        isPartialSend,
        recipients,
        groupId,
      });

      log.info('handleSendCallMessageToGroup() completed successfully');
      return true;
    } catch (err) {
      const errorString = Errors.toLogFormat(err);
      log.error(
        `handleSendCallMessageToGroup() failed to queue job: ${errorString}`
      );
      return false;
    }
  }

  async #handleGroupCallRingUpdate(
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
    const ringerAci = normalizeAci(ringerUuid, 'handleGroupCallRingUpdate');

    const conversation = window.ConversationController.get(groupId);
    if (!conversation) {
      log.error('handleGroupCallRingUpdate(): could not find conversation');
      return;
    }

    if (update === RingUpdate.Requested) {
      this.#reduxInterface?.peekNotConnectedGroupCall({
        callMode: CallMode.Group,
        conversationId: conversation.id,
      });
    }

    const logId = `handleGroupCallRingUpdate(${conversation.idForLogging()})`;
    if (conversation.isBlocked()) {
      log.warn(`${logId}: is blocked`);
      return;
    }

    const ourAci = window.textsecure.storage.user.getCheckedAci();

    if (conversation.get('left') || !conversation.hasMember(ourAci)) {
      log.warn(`${logId}: we left the group`);
      return;
    }

    if (!conversation.hasMember(ringerAci)) {
      log.warn(`${logId}: they left the group`);
      return;
    }

    if (
      conversation.get('announcementsOnly') &&
      !conversation.isAdmin(ringerAci)
    ) {
      log.warn(`${logId}: non-admin update to announcement-only group`);
      return;
    }

    const conversationId = conversation.id;

    let shouldRing = false;

    if (update === RingUpdate.Requested) {
      if (await wasGroupCallRingPreviouslyCanceled(ringId)) {
        RingRTC.cancelGroupRing(groupIdBytes, ringId, null);
      } else if (this.#areAnyCallsActiveOrRinging()) {
        RingRTC.cancelGroupRing(groupIdBytes, ringId, RingCancelReason.Busy);
      } else if (window.Events.getIncomingCallNotification()) {
        shouldRing = true;
      } else {
        log.info(
          'Incoming calls are disabled. Ignoring group call ring request'
        );
      }
    } else {
      await processGroupCallRingCancellation(ringId);
    }

    if (shouldRing) {
      log.info('handleGroupCallRingUpdate: ringing');
      this.#reduxInterface?.receiveIncomingGroupCall({
        conversationId,
        ringId,
        ringerAci,
      });
    } else {
      log.info('handleGroupCallRingUpdate: canceling the existing ring');
      this.#reduxInterface?.cancelIncomingGroupCallRing({
        conversationId,
        ringId,
      });
    }

    const localEventFromRing = getLocalCallEventFromRingUpdate(update);
    if (localEventFromRing != null) {
      const callId = getCallIdFromRing(ringId);
      const callDetails = getCallDetailsFromGroupCallMeta(groupId, {
        callId,
        ringerId: ringerAci,
      });
      let localEventForCall;
      if (localEventFromRing === LocalCallEvent.Missed) {
        localEventForCall = LocalCallEvent.Missed;
      } else {
        localEventForCall = shouldRing
          ? LocalCallEvent.Ringing
          : LocalCallEvent.Started;
      }
      const callEvent = getCallEventDetails(
        callDetails,
        localEventForCall,
        'CallingClass.handleGroupCallRingUpdate'
      );
      await updateCallHistoryFromLocalEvent(callEvent, null, null);
    }
  }

  // Used for all 1:1 call messages, including the initial message to start the call
  async #handleOutgoingSignaling(
    remoteUserId: UserId,
    message: CallingMessage,
    urgency?: CallMessageUrgency
  ): Promise<boolean> {
    assertDev(
      isServiceIdString(remoteUserId),
      'remoteUserId is not a service id'
    );
    const conversation = window.ConversationController.getOrCreate(
      remoteUserId,
      'private'
    );

    // We want 1:1 call initiate messages to wake up recipient devices, but not others
    const urgent =
      urgency === CallMessageUrgency.HandleImmediately ||
      Boolean(message.offer);

    try {
      const proto = callingMessageToProto(message, urgency);
      const protoBytes = Proto.CallMessage.encode(proto).finish();
      const protoBase64 = Bytes.toBase64(protoBytes);

      await conversationJobQueue.add({
        type: 'CallingMessage',
        conversationId: conversation.id,
        protoBase64,
        urgent,
      });

      return true;
    } catch (err) {
      const errorString = Errors.toLogFormat(err);
      log.error(
        `handleOutgoingSignaling() failed to queue job: ${errorString}`
      );
      return false;
    }
  }

  // If we return null here, we hang up the call.
  async #handleIncomingCall(call: Call): Promise<boolean> {
    log.info('CallingClass.handleIncomingCall()');

    if (!this.#reduxInterface || !this.#localDeviceId) {
      log.error('Missing required objects, ignoring incoming call.');
      return false;
    }

    const conversation = window.ConversationController.get(call.remoteUserId);
    if (!conversation) {
      log.error('Missing conversation, ignoring incoming call.');
      return false;
    }

    if (conversation.isBlocked()) {
      log.warn(
        `handleIncomingCall(): ${conversation.idForLogging()} is blocked`
      );
      return false;
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

        const localCallEvent = LocalCallEvent.Missed;
        const peerId = getPeerIdFromConversation(conversation.attributes);
        const callDetails = getCallDetailsFromDirectCall(peerId, call);
        const callEvent = getCallEventDetails(
          callDetails,
          localCallEvent,
          'CallingClass.handleIncomingCall'
        );
        await updateCallHistoryFromLocalEvent(callEvent, null, null);

        return false;
      }

      this.#attachToCall(conversation, call);

      this.#reduxInterface.receiveIncomingDirectCall({
        conversationId: conversation.id,
        isVideoCall: call.isVideoCall,
      });

      return true;
    } catch (err) {
      log.error(`Ignoring incoming call: ${Errors.toLogFormat(err)}`);
      return false;
    }
  }

  async #handleAutoEndedIncomingCallRequest(
    callIdValue: CallId,
    remoteUserId: UserId,
    callEndedReason: CallEndedReason,
    ageInSeconds: number,
    wasVideoCall: boolean,
    receivedAtCounter: number | undefined,
    receivedAtMS: number | undefined = undefined
  ) {
    const conversation = window.ConversationController.get(remoteUserId);
    if (!conversation) {
      return;
    }

    const callId = Long.fromValue(callIdValue).toString();
    const peerId = getPeerIdFromConversation(conversation.attributes);

    // This is extra defensive, just in case RingRTC passes us a bad value. (It probably
    //   won't.)
    const ageInMilliseconds =
      isNormalNumber(ageInSeconds) && ageInSeconds >= 0
        ? ageInSeconds * durations.SECOND
        : 0;
    const timestamp = Date.now() - ageInMilliseconds;

    const callDetails = getCallDetailsFromEndedDirectCall(
      callId,
      peerId,
      remoteUserId,
      wasVideoCall,
      timestamp
    );
    const localCallEvent =
      getLocalCallEventFromCallEndedReason(callEndedReason);
    const callEvent = getCallEventDetails(
      callDetails,
      localCallEvent,
      'CallingClass.handleAutoEndedIncomingCallRequest'
    );

    if (!this.#reduxInterface) {
      log.error(
        'handleAutoEndedIncomingCallRequest: Unable to update redux for call'
      );
    }
    this.#reduxInterface?.callStateChange({
      acceptedTime: null,
      callEndedReason,
      callState: CallState.Ended,
      conversationId: conversation.id,
    });

    await updateCallHistoryFromLocalEvent(
      callEvent,
      receivedAtCounter ?? null,
      receivedAtMS ?? null
    );
  }

  #attachToCall(conversation: ConversationModel, call: Call): void {
    this.#callsLookup[conversation.id] = call;

    const reduxInterface = this.#reduxInterface;
    if (!reduxInterface) {
      return;
    }

    let acceptedTime: number | null = null;

    // eslint-disable-next-line no-param-reassign
    call.handleStateChanged = async () => {
      if (call.state === CallState.Accepted) {
        acceptedTime = acceptedTime ?? Date.now();
      }

      if (call.state === CallState.Ended) {
        this.#stopDeviceReselectionTimer();
        this.#lastMediaDeviceSettings = undefined;
        delete this.#callsLookup[conversation.id];
      }

      const localCallEvent = getLocalCallEventFromDirectCall(call);
      if (localCallEvent != null) {
        const peerId = getPeerIdFromConversation(conversation.attributes);
        const callDetails = getCallDetailsFromDirectCall(peerId, call);
        const callEvent = getCallEventDetails(
          callDetails,
          localCallEvent,
          'call.handleStateChanged'
        );
        await updateCallHistoryFromLocalEvent(callEvent, null, null);
      }

      reduxInterface.callStateChange({
        conversationId: conversation.id,
        callState: call.state,
        callEndedReason: call.endedReason,
        acceptedTime,
      });
    };

    // eslint-disable-next-line no-param-reassign
    call.handleRemoteAudioEnabled = () => {
      // TODO: Implement handling for the remote audio state using call.remoteAudioEnabled
    };

    // eslint-disable-next-line no-param-reassign
    call.handleRemoteVideoEnabled = () => {
      reduxInterface.remoteVideoChange({
        conversationId: conversation.id,
        hasVideo: call.remoteVideoEnabled,
      });
    };

    // eslint-disable-next-line no-param-reassign
    call.handleRemoteSharingScreen = () => {
      reduxInterface.remoteSharingScreenChange({
        conversationId: conversation.id,
        isSharingScreen: Boolean(call.remoteSharingScreen),
      });
    };

    // eslint-disable-next-line no-param-reassign
    call.handleLowBandwidthForVideo = _recovered => {
      // TODO: Implement handling of "low outgoing bandwidth for video" notification.
    };
  }

  async #handleLogMessage(
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

  async #handleRtcStatsReport(reportJson: string) {
    // assumes one active call
    const conversationId = Object.keys(this.#callsLookup)[0] ?? '';
    const callId = this.#callDebugNumber;

    ipcRenderer.send('calling:rtc-stats-report', {
      conversationId,
      callId,
      reportJson,
    });
  }

  async #handleSendHttpRequest(
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

  #getRemoteUserIdFromConversation(
    conversation: ConversationModel
  ): UserId | undefined | null {
    const recipients = conversation.getRecipients();
    if (recipients.length !== 1) {
      return undefined;
    }
    return recipients[0];
  }

  get #localDeviceId(): DeviceId | null {
    return this.#parseDeviceId(window.textsecure.storage.user.getDeviceId());
  }

  #parseDeviceId(deviceId: number | string | undefined): DeviceId | null {
    if (typeof deviceId === 'string') {
      return parseInt(deviceId, 10);
    }
    if (typeof deviceId === 'number') {
      return deviceId;
    }
    return null;
  }

  async #handleStartCall(call: Call): Promise<boolean> {
    type IceServer = {
      username?: string;
      password?: string;
      hostname?: string;
      urls: Array<string>;
    };

    function iceServerConfigToList(
      iceServerConfig: GetIceServersResultType
    ): Array<IceServer> {
      if (!iceServerConfig.relays) {
        return [];
      }

      return iceServerConfig.relays.flatMap(iceServerGroup => [
        {
          hostname: iceServerGroup.hostname ?? '',
          username: iceServerGroup.username,
          password: iceServerGroup.password,
          urls: (iceServerGroup.urlsWithIps ?? []).slice(),
        },
        {
          hostname: '',
          username: iceServerGroup.username,
          password: iceServerGroup.password,
          urls: (iceServerGroup.urls ?? []).slice(),
        },
      ]);
    }

    if (!window.textsecure.messaging) {
      log.error('handleStartCall: offline!');
      return false;
    }

    const iceServerConfig =
      await window.textsecure.messaging.server.getIceServers();

    const shouldRelayCalls = window.Events.getAlwaysRelayCalls();

    const conversation = window.ConversationController.get(call.remoteUserId);
    if (!conversation) {
      log.error('Missing conversation, ignoring incoming call.');
      return false;
    }

    // If the peer is not a Signal Connection, force IP hiding.
    const isContactUntrusted = !isSignalConnection(conversation.attributes);

    // Prioritize ice servers with IPs to avoid DNS only include
    // hostname with urlsWithIps.
    let iceServers = iceServerConfigToList(iceServerConfig);

    if (this._iceServerOverride) {
      if (typeof this._iceServerOverride === 'string') {
        if (ICE_SERVER_IS_IP_LIKE.test(this._iceServerOverride)) {
          iceServers[0].urls = [this._iceServerOverride];
          iceServers = [iceServers[0]];
        } else {
          iceServers[1].urls = [this._iceServerOverride];
          iceServers = [iceServers[1]];
        }
      } else {
        iceServers = iceServerConfigToList(this._iceServerOverride);
      }
    }

    const callSettings = {
      iceServers,
      hideIp: shouldRelayCalls || isContactUntrusted,
      dataMode: DataMode.Normal,
      // TODO: DESKTOP-3101
      // audioLevelsIntervalMillis: AUDIO_LEVEL_INTERVAL_MS,
    };

    log.info('CallingClass.handleStartCall(): Proceeding');
    RingRTC.proceed(call.callId, callSettings);

    return true;
  }

  public async updateCallHistoryForAdhocCall(
    roomId: string,
    joinState: GroupCallJoinState | null,
    peekInfo: PeekInfo | null
  ): Promise<void> {
    if (!peekInfo?.eraId) {
      return;
    }
    const callId = getCallIdFromEra(peekInfo.eraId);

    try {
      let localCallEvent;
      if (joinState === GroupCallJoinState.Joined) {
        localCallEvent = LocalCallEvent.Accepted;
      } else if (peekInfo && peekInfo.devices.length > 0) {
        localCallEvent = LocalCallEvent.Started;
      } else {
        return;
      }

      const callDetails = getCallDetailsForAdhocCall(roomId, callId);
      const callEvent = getCallEventDetails(
        callDetails,
        localCallEvent,
        'CallingClass.updateCallHistoryForAdhocCall'
      );
      await updateAdhocCallHistory(callEvent);
    } catch (error) {
      log.error(
        'CallingClass.updateCallHistoryForAdhocCall: Error updating state',
        Errors.toLogFormat(error)
      );
    }
  }

  public async updateCallHistoryForGroupCallOnLocalChanged(
    conversationId: string,
    joinState: GroupCallJoinState | null,
    peekInfo: PeekInfo | null
  ): Promise<void> {
    const groupCallMeta = getGroupCallMeta(peekInfo);
    if (!groupCallMeta) {
      return;
    }

    try {
      const localCallEvent = getLocalCallEventFromJoinState(
        joinState,
        groupCallMeta
      );

      if (!localCallEvent) {
        return;
      }

      const conversation = window.ConversationController.get(conversationId);
      strictAssert(
        conversation != null,
        'CallingClass.updateCallHistoryForGroupCallOnLocalChanged: Missing conversation'
      );
      const peerId = getPeerIdFromConversation(conversation.attributes);

      const callDetails = getCallDetailsFromGroupCallMeta(
        peerId,
        groupCallMeta
      );
      const callEvent = getCallEventDetails(
        callDetails,
        localCallEvent,
        'CallingClass.updateCallHistoryForGroupCallOnLocalChanged'
      );
      await updateCallHistoryFromLocalEvent(callEvent, null, null);
    } catch (error) {
      log.error(
        'CallingClass.updateCallHistoryForGroupCallOnLocalChanged: Error updating state',
        Errors.toLogFormat(error)
      );
    }
  }

  public async updateCallHistoryForGroupCallOnPeek(
    conversationId: string,
    joinState: GroupCallJoinState | null,
    peekInfo: PeekInfo | null
  ): Promise<void> {
    const groupCallMeta = getGroupCallMeta(peekInfo);
    // If we don't have the necessary pieces to peek, bail. (It's okay if we don't.)
    if (groupCallMeta == null) {
      return;
    }

    const creatorConversation = window.ConversationController.get(
      groupCallMeta.ringerId
    );

    const conversation = window.ConversationController.get(conversationId);
    if (!conversation) {
      log.error(
        'updateCallHistoryForGroupCallOnPeek(): could not find conversation'
      );
      return;
    }

    const prevMessageId = await DataReader.getCallHistoryMessageByCallId({
      conversationId: conversation.id,
      callId: groupCallMeta.callId,
    });

    const isNewCall = prevMessageId == null;

    if (isNewCall) {
      const localCallEvent = getLocalCallEventFromJoinState(
        joinState,
        groupCallMeta
      );
      if (localCallEvent != null) {
        const peerId = getPeerIdFromConversation(conversation.attributes);
        const callDetails = getCallDetailsFromGroupCallMeta(
          peerId,
          groupCallMeta
        );
        const callEvent = getCallEventDetails(
          callDetails,
          localCallEvent,
          'CallingClass.updateCallHistoryForGroupCallOnPeek'
        );
        await updateCallHistoryFromLocalEvent(callEvent, null, null);
      }
    }

    const wasStartedByMe = Boolean(
      creatorConversation && isMe(creatorConversation.attributes)
    );
    const isAnybodyElseInGroupCall = Boolean(peekInfo?.devices.length);

    if (
      isNewCall &&
      !wasStartedByMe &&
      isAnybodyElseInGroupCall &&
      !conversation.isMuted()
    ) {
      await this.#notifyForGroupCall(conversation, creatorConversation);
    }
  }

  async #notifyForGroupCall(
    conversation: Readonly<ConversationModel>,
    creatorConversation: undefined | Readonly<ConversationModel>
  ): Promise<void> {
    let notificationTitle: string;
    let notificationMessage: string;

    switch (notificationService.getNotificationSetting()) {
      case NotificationSetting.Off:
        return;
      case NotificationSetting.NoNameOrMessage:
        notificationTitle = FALLBACK_NOTIFICATION_TITLE;
        notificationMessage = window.i18n(
          'icu:calling__call-notification__started-by-someone'
        );
        break;
      default:
        // These fallbacks exist just in case something unexpected goes wrong.
        notificationTitle =
          conversation?.getTitle() || FALLBACK_NOTIFICATION_TITLE;
        notificationMessage = creatorConversation
          ? window.i18n('icu:calling__call-notification__started', {
              name: creatorConversation.getTitle(),
            })
          : window.i18n('icu:calling__call-notification__started-by-someone');
        break;
    }

    const { url, absolutePath } = await conversation.getAvatarOrIdenticon();

    notificationService.notify({
      conversationId: conversation.id,
      iconPath: absolutePath,
      iconUrl: url,
      message: notificationMessage,
      type: NotificationType.IncomingGroupCall,
      sentAt: 0,
      silent: false,
      title: notificationTitle,
    });
  }

  #areAnyCallsActiveOrRinging(): boolean {
    return this.#reduxInterface?.areAnyCallsActiveOrRinging() ?? false;
  }

  async #cleanExpiredGroupCallRingsAndLoop(): Promise<void> {
    try {
      await cleanExpiredGroupCallRingCancellations();
    } catch (err: unknown) {
      // These errors are ignored here. They should be logged elsewhere and it's okay if
      //   we don't do a cleanup this time.
    }

    setTimeout(() => {
      void this.#cleanExpiredGroupCallRingsAndLoop();
    }, CLEAN_EXPIRED_GROUP_CALL_RINGS_INTERVAL);
  }

  // MacOS: Preload devices to work around delay when first entering call lobby
  // https://bugs.chromium.org/p/chromium/issues/detail?id=1287628
  async #enumerateMediaDevices(): Promise<void> {
    try {
      const microphoneStatus =
        await window.IPC.getMediaAccessStatus('microphone');
      if (microphoneStatus !== 'granted') {
        return;
      }

      drop(window.navigator.mediaDevices.enumerateDevices());
    } catch (error) {
      log.error('enumerateMediaDevices failed:', Errors.toLogFormat(error));
    }
  }
}

export const calling = new CallingClass();
