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
  CallLinkEpoch,
  CallLogLevel,
  CallState,
  ConnectionState,
  DataMode,
  JoinState,
  HttpMethod,
  GroupCall,
  GroupMemberInfo,
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
import * as muteStateChange from '@signalapp/mute-state-change';
import lodash from 'lodash';
import Long from 'long';
import type { CallLinkAuthCredentialPresentation } from '@signalapp/libsignal-client/zkgroup.js';
import {
  CallLinkSecretParams,
  CreateCallLinkCredentialRequestContext,
  CreateCallLinkCredentialResponse,
  GenericServerPublicParams,
  ServerPublicParams,
} from '@signalapp/libsignal-client/zkgroup.js';
import { Aci } from '@signalapp/libsignal-client';
import {
  CanvasVideoRenderer,
  GumVideoCapturer,
} from '../calling/VideoSupport.preload.js';
import type { GumVideoCaptureOptions } from '../calling/VideoSupport.preload.js';
import type {
  ActionsType as CallingReduxActionsType,
  GroupCallParticipantInfoType,
  GroupCallPeekInfoType,
} from '../state/ducks/calling.preload.js';
import type { ConversationType } from '../state/ducks/conversations.preload.js';
import { getConversationCallMode } from '../state/ducks/conversations.preload.js';
import { isMe } from '../util/whatTypeOfConversation.dom.js';
import { getAbsoluteTempPath } from '../util/migrations.preload.js';
import type {
  AvailableIODevicesType,
  CallEndedReason,
  IceServerType,
  IceServerCacheType,
  MediaDeviceSettings,
  PresentedSource,
} from '../types/Calling.std.js';
import {
  GroupCallConnectionState,
  GroupCallJoinState,
  ScreenShareStatus,
} from '../types/Calling.std.js';
import { CallMode, LocalCallEvent } from '../types/CallDisposition.std.js';
import {
  findBestMatchingAudioDeviceIndex,
  findBestMatchingCameraId,
} from '../calling/findBestMatchingDevice.std.js';
import { normalizeAci } from '../util/normalizeAci.std.js';
import { isAciString } from '../util/isAciString.std.js';
import * as Errors from '../types/errors.std.js';
import type { ConversationModel } from '../models/conversations.preload.js';
import * as Bytes from '../Bytes.std.js';
import { uuidToBytes, bytesToUuid } from '../util/uuidToBytes.std.js';
import { drop } from '../util/drop.std.js';
import { dropNull } from '../util/dropNull.std.js';
import { getOwn } from '../util/getOwn.std.js';
import * as durations from '../util/durations/index.std.js';
import { clearTimeoutIfNecessary } from '../util/clearTimeoutIfNecessary.std.js';
import { fetchMembershipProof, getMembershipList } from '../groups.preload.js';
import type { ProcessedEnvelope } from '../textsecure/Types.d.ts';
import type { GetIceServersResultType } from '../textsecure/WebAPI.preload.js';
import {
  callLinkCreateAuth,
  getIceServers,
  makeSfuRequest,
} from '../textsecure/WebAPI.preload.js';
import { missingCaseError } from '../util/missingCaseError.std.js';
import { normalizeGroupCallTimestamp } from '../util/ringrtc/normalizeGroupCallTimestamp.std.js';
import { requestCameraPermissions } from '../util/callingPermissions.dom.js';
import {
  AUDIO_LEVEL_INTERVAL_MS,
  REQUESTED_VIDEO_WIDTH,
  REQUESTED_VIDEO_HEIGHT,
  REQUESTED_VIDEO_FRAMERATE,
  REQUESTED_GROUP_VIDEO_WIDTH,
  REQUESTED_GROUP_VIDEO_HEIGHT,
  REQUESTED_SCREEN_SHARE_WIDTH,
  REQUESTED_SCREEN_SHARE_HEIGHT,
  REQUESTED_SCREEN_SHARE_FRAMERATE,
} from '../calling/constants.std.js';
import { callingMessageToProto } from '../util/callingMessageToProto.node.js';
import { requestMicrophonePermissions } from '../util/requestMicrophonePermissions.dom.js';
import { SignalService as Proto } from '../protobuf/index.std.js';
import { DataReader, DataWriter } from '../sql/Client.preload.js';
import {
  notificationService,
  NotificationSetting,
  FALLBACK_NOTIFICATION_TITLE,
  shouldSaveNotificationAvatarToDisk,
} from './notifications.preload.js';
import { createLogger } from '../logging/log.std.js';
import { assertDev, strictAssert } from '../util/assert.std.js';
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
} from '../util/callDisposition.preload.js';
import { isNormalNumber } from '../util/isNormalNumber.std.js';
import type { AciString, ServiceIdString } from '../types/ServiceId.std.js';
import { isServiceIdString, isPniString } from '../types/ServiceId.std.js';
import { NotificationType } from '../types/notifications.std.js';
import { isSignalConnection } from '../util/getSignalConnections.preload.js';
import { toAdminKeyBytes } from '../util/callLinks.std.js';
import {
  getRoomIdFromRootKey,
  callLinkRestrictionsToRingRTC,
  callLinkStateFromRingRTC,
} from '../util/callLinksRingrtc.node.js';
import { getCallLinkAuthCredentialPresentation } from '../util/callLinks/zkgroup.preload.js';
import {
  conversationJobQueue,
  conversationQueueJobEnum,
} from '../jobs/conversationJobQueue.preload.js';
import type { CallLinkType, CallLinkStateType } from '../types/CallLink.std.js';
import { CallLinkRestrictions } from '../types/CallLink.std.js';
import { getConversationIdForLogging } from '../util/idForLogging.preload.js';
import { sendCallLinkUpdateSync } from '../util/sendCallLinkUpdateSync.preload.js';
import { createIdenticon } from '../util/createIdenticon.preload.js';
import { getColorForCallLink } from '../util/getColorForCallLink.std.js';
import OS from '../util/os/osMain.node.js';
import { sleep } from '../util/sleep.std.js';
import { signalProtocolStore } from '../SignalProtocolStore.preload.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

const { i18n } = window.SignalContext;

const { uniqBy, noop, compact } = lodash;

const log = createLogger('calling');
const ringrtcLog = createLogger('@signalapp/ringrtc');

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
const OUTGOING_SIGNALING_WAIT = 15 * durations.SECOND;

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
  | 'declineCall'
  | 'directCallAudioLevelsChange'
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
  | 'remoteAudioChange'
  | 'remoteSharingScreenChange'
  | 'remoteVideoChange'
  | 'sendGroupCallRaiseHand'
  | 'startCallingLobby'
  | 'startCallLinkLobby'
  | 'startCallLinkLobbyByRoomId'
  | 'peekNotConnectedGroupCall'
  | 'setSuggestLowerHand'
  | 'setLocalAudio'
  | 'setMutedBy'
  | 'onObservedRemoteMute'
> & {
  areAnyCallsActiveOrRinging(): boolean;
};

export type SetPresentingOptionsType = Readonly<{
  conversationId: string;
  mediaStream?: MediaStream;
  source?: PresentedSource;
  callLinkRootKey?: string;
}>;

function getIncomingCallNotification(): boolean {
  return itemStorage.get('incoming-call-notification', true);
}
function getAlwaysRelayCalls(): boolean {
  return itemStorage.get('always-relay-calls', false);
}

function getPreferredAudioInputDevice(): AudioDevice | undefined {
  return itemStorage.get('preferred-audio-input-device');
}
async function setPreferredAudioInputDevice(
  device: AudioDevice
): Promise<void> {
  await itemStorage.put('preferred-audio-input-device', device);
}

function getPreferredAudioOutputDevice(): AudioDevice | undefined {
  return itemStorage.get('preferred-audio-output-device');
}
async function setPreferredAudioOutputDevice(
  device: AudioDevice
): Promise<void> {
  await itemStorage.put('preferred-audio-output-device', device);
}

function getPreferredVideoInputDevice(): string | undefined {
  return itemStorage.get('preferred-video-input-device');
}
async function setPreferredVideoInputDevice(device: string): Promise<void> {
  await itemStorage.put('preferred-video-input-device', device);
}

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
          new IceCandidateMessage(candidate.id, candidate.opaque)
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
            offer.opaque
          )
        : undefined,
    answer:
      answer && answer.id && answer.opaque
        ? new AnswerMessage(answer.id, answer.opaque)
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
          data: opaque.data ? opaque.data : undefined,
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

async function ensureSystemPermissions({
  hasLocalVideo,
  hasLocalAudio,
}: {
  hasLocalVideo: boolean;
  hasLocalAudio: boolean;
}): Promise<void> {
  if (hasLocalAudio) {
    await window.reduxActions.globalModals.ensureSystemMediaPermissions(
      'microphone',
      'call'
    );
  }
  if (hasLocalVideo) {
    await window.reduxActions.globalModals.ensureSystemMediaPermissions(
      'camera',
      'call'
    );
  }
}

async function checkCameraPermission(): Promise<boolean> {
  // If user never went through on boarding, the value is going to be
  // `undefined` and we should ask for permissions. If it is explicitly `false`
  // camera is intentionally not available.
  const cameraPermission = await window.IPC.getMediaCameraPermissions();
  if (cameraPermission === false) {
    return false;
  }
  const status = await window.IPC.getMediaAccessStatus('camera');
  return status !== 'denied';
}

function getLogId(
  options:
    | {
        source: string;
        additional?: string;
        conversationId: string | undefined;
      }
    | {
        source: string;
        additional?: string;
        conversation: ConversationModel | undefined;
      }
    | {
        source: string;
        additional?: string;
        conversationType: ConversationType | undefined;
      }
): string {
  const { source, additional } = options;
  let idForLogging: string;

  if ('conversationId' in options) {
    idForLogging =
      window.ConversationController.get(
        options.conversationId
      )?.idForLogging() ?? 'not found';
  } else if ('conversation' in options) {
    idForLogging = options.conversation?.idForLogging() ?? 'not found';
  } else {
    const { conversationType } = options;
    idForLogging = conversationType
      ? getConversationIdForLogging(conversationType)
      : 'not found';
  }

  const additionalText = additional ? `/${additional}` : '';

  return `${source}(${idForLogging}${additionalText})`;
}

const DIRECT_CALL_OPTIONS: GumVideoCaptureOptions = {
  maxWidth: REQUESTED_VIDEO_WIDTH,
  maxHeight: REQUESTED_VIDEO_HEIGHT,
  maxFramerate: REQUESTED_VIDEO_FRAMERATE,
};

const GROUP_CALL_OPTIONS: GumVideoCaptureOptions = {
  maxWidth: REQUESTED_GROUP_VIDEO_WIDTH,
  maxHeight: REQUESTED_GROUP_VIDEO_HEIGHT,
  maxFramerate: REQUESTED_VIDEO_FRAMERATE,
};

export class CallingClass {
  readonly #videoCapturer: GumVideoCapturer;
  readonly videoRenderer: CanvasVideoRenderer;

  #localPreviewContainer: HTMLDivElement | null = null;
  #localPreview: HTMLVideoElement | undefined;
  #reduxInterface?: CallingReduxInterface;

  public _sfuUrl?: string;

  public _iceServerOverride?: GetIceServersResultType | string;

  // A cache to limit requests for relay servers.
  #iceServersCache: IceServerCacheType | undefined;

  #lastMediaDeviceSettings?: MediaDeviceSettings;
  #deviceReselectionTimer?: NodeJS.Timeout;
  #callsLookup: { [key: string]: Call | GroupCall };
  #currentRtcStatsInterval: number | null = null;
  #callDebugNumber: number = 0;

  #cameraEnabled: boolean = false;

  // Send our profile key to other participants in call link calls to ensure they
  // can see our profile info. Only send once per aci until the next app start.
  #sendProfileKeysForAdhocCallCache: Set<AciString>;

  constructor() {
    this.#videoCapturer = new GumVideoCapturer(DIRECT_CALL_OPTIONS);
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
    });

    RingRTC.handleOutgoingSignaling = this.#handleOutgoingSignaling.bind(this);
    RingRTC.handleIncomingCall = this.#handleIncomingCall.bind(this);
    RingRTC.handleStartCall = this.#handleStartCall.bind(this);
    RingRTC.handleOutputDeviceChanged =
      this.#handleOutputDeviceChanged.bind(this);
    RingRTC.handleInputDeviceChanged =
      this.#handleInputDeviceChanged.bind(this);
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

    // This has effect only on macOS >= 14.0
    muteStateChange.subscribe(isMuted => {
      log.info(`muteState notification: isMuted=${isMuted}`);

      // Immediately mute all calls
      for (const call of Object.values(this.#callsLookup)) {
        call.setOutgoingAudioMuted(isMuted);
      }

      // Trigger UI update
      reduxInterface.setLocalAudio({ enabled: !isMuted, isUIOnly: true });
    });
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
    const ourAci = itemStorage.user.getAci();
    if (!ourAci) {
      // This can happen if we're not linked. It's okay if we hit this case.
      return;
    }

    RingRTC.setSelfUuid(uuidToBytes(ourAci));
  }

  async startCallingLobby({
    conversation,
    hasLocalAudio,
    preferLocalVideo,
  }: Readonly<{
    conversation: Readonly<ConversationType>;
    hasLocalAudio: boolean;
    preferLocalVideo: boolean;
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
    const logId = getLogId({
      source: 'CallingClass.startCallingLobby',
      conversationType: conversation,
    });
    log.info(logId);

    muteStateChange.setIsMuted(!hasLocalAudio);

    const callMode = getConversationCallMode(conversation);
    switch (callMode) {
      case null:
        log.error(
          `${logId}: Conversation does not support calls, new call not allowed.`
        );
        return;
      case CallMode.Direct: {
        const conversationModel = window.ConversationController.get(
          conversation.id
        );
        if (
          !conversationModel ||
          !this.#getRemoteUserIdFromConversation(conversationModel)
        ) {
          log.error(
            `${logId}: Missing remote user identifier, new call not allowed.`
          );
          return;
        }
        break;
      }
      case CallMode.Group:
        break;
      case CallMode.Adhoc:
        log.error(
          `${logId}: not implemented for adhoc calls. Did you mean: startCallLinkLobby()?`
        );
        return;
      default:
        throw missingCaseError(callMode);
    }

    if (!this.#reduxInterface) {
      log.error(`${logId}: Missing uxActions, new call not allowed.`);
      return;
    }

    if (!this.#localDeviceId) {
      log.error(
        `${logId}: Missing local device identifier, new call not allowed.`
      );
      return;
    }

    const hasLocalVideo = preferLocalVideo && (await checkCameraPermission());

    const haveMediaPermissions = await this.#requestPermissions(hasLocalVideo);
    if (!haveMediaPermissions) {
      log.info(`${logId}: Permissions were denied, new call not allowed.`);
      return;
    }

    log.info(`${logId}: Starting lobby`);
    await ensureSystemPermissions({ hasLocalAudio, hasLocalVideo });

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
      ? () => drop(this.enableLocalCamera(callMode))
      : noop;

    switch (callMode) {
      case CallMode.Direct:
        // We could easily support this in the future if we need to.
        assertDev(
          hasLocalAudio,
          'Expected local audio to be enabled for direct call lobbies'
        );
        enableLocalCameraIfNecessary();

        log.info(`${logId}: Returning direct call`);
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
            `${logId}: Conversation is missing required parameters. Cannot connect group call`
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

        log.info(`${logId}: Returning group call`);
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
    const logId = getLogId({
      source: 'CallingClass.stopCallingLobby',
      conversationId,
    });
    log.info(logId);

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
      itemStorage.user.getCheckedAci()
    );

    const rootKey = CallLinkRootKey.generate();
    const roomId = rootKey.deriveRoomId();
    const roomIdHex = Bytes.toHex(roomId);
    const logId = `createCallLink(${roomIdHex})`;

    log.info(`${logId}: Creating call link`);

    const adminKey = CallLinkRootKey.generateAdminPassKey();

    const context = CreateCallLinkCredentialRequestContext.forRoomId(roomId);
    const requestBase64 = Bytes.toBase64(context.getRequest().serialize());

    const { credential: credentialBase64 } =
      await callLinkCreateAuth(requestBase64);

    const response = new CreateCallLinkCredentialResponse(
      Bytes.fromBase64(credentialBase64)
    );

    const genericServerPublicParams = new GenericServerPublicParams(
      Bytes.fromBase64(window.getGenericServerPublicParams())
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
    const { epoch } = result.value;
    const state = callLinkStateFromRingRTC(result.value);

    const callLink: CallLinkType = {
      roomId: roomIdHex,
      rootKey: rootKey.toString(),
      epoch: epoch ? epoch.toString() : null,
      adminKey: Bytes.toBase64(adminKey),
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
    log.info(logId);

    const callLinkRootKey = CallLinkRootKey.parse(callLink.rootKey);
    const callLinkEpoch = callLink.epoch
      ? CallLinkEpoch.parse(callLink.epoch)
      : undefined;
    strictAssert(callLink.adminKey, 'Missing admin key');
    const callLinkAdminKey = toAdminKeyBytes(callLink.adminKey);
    const authCredentialPresentation =
      await getCallLinkAuthCredentialPresentation(callLinkRootKey);

    const result = await RingRTC.deleteCallLink(
      sfuUrl,
      authCredentialPresentation.serialize(),
      callLinkRootKey,
      callLinkEpoch,
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
    const callLinkEpoch = callLink.epoch
      ? CallLinkEpoch.parse(callLink.epoch)
      : undefined;
    strictAssert(callLink.adminKey, 'Missing admin key');
    const callLinkAdminKey = toAdminKeyBytes(callLink.adminKey);
    const authCredentialPresentation =
      await getCallLinkAuthCredentialPresentation(callLinkRootKey);
    const result = await RingRTC.updateCallLinkName(
      sfuUrl,
      authCredentialPresentation.serialize(),
      callLinkRootKey,
      callLinkEpoch,
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
    const callLinkEpoch = callLink.epoch
      ? CallLinkEpoch.parse(callLink.epoch)
      : undefined;
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
      callLinkEpoch,
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
    callLinkRootKey: CallLinkRootKey,
    callLinkEpoch: CallLinkEpoch | undefined
  ): Promise<CallLinkStateType | null> {
    if (!this._sfuUrl) {
      throw new Error('readCallLink() missing SFU URL; not handling call link');
    }

    const roomId = getRoomIdFromRootKey(callLinkRootKey);
    const logId = `readCallLink(${roomId})`;
    log.info(logId);

    const authCredentialPresentation =
      await getCallLinkAuthCredentialPresentation(callLinkRootKey);

    const result = await RingRTC.readCallLink(
      this._sfuUrl,
      authCredentialPresentation.serialize(),
      callLinkRootKey,
      callLinkEpoch
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
    callLinkEpoch,
    adminPasskey,
    hasLocalAudio,
    preferLocalVideo = true,
  }: Readonly<{
    callLinkRootKey: CallLinkRootKey;
    callLinkEpoch: CallLinkEpoch | undefined;
    adminPasskey: Uint8Array | undefined;
    hasLocalAudio: boolean;
    preferLocalVideo?: boolean;
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
    const logId = `startCallLinkLobby(roomId=${roomId})`;
    log.info(`${logId}: starting`);

    muteStateChange.setIsMuted(!hasLocalAudio);
    const hasLocalVideo = preferLocalVideo && (await checkCameraPermission());

    const haveMediaPermissions = await this.#requestPermissions(hasLocalVideo);
    if (!haveMediaPermissions) {
      log.info(
        `${logId}: Permissions were denied, but allow joining group call`
      );
    }

    await ensureSystemPermissions({ hasLocalAudio, hasLocalVideo });

    await this.#startDeviceReselectionTimer();

    const authCredentialPresentation =
      await getCallLinkAuthCredentialPresentation(callLinkRootKey);
    const serverPublicParams = new ServerPublicParams(
      Buffer.from(window.getServerPublicParams(), 'base64')
    );
    const endorsementsPublicKey = serverPublicParams.getEndorsementPublicKey();

    const groupCall = this.connectCallLinkCall({
      roomId,
      authCredentialPresentation,
      callLinkRootKey,
      callLinkEpoch,
      adminPasskey,
      endorsementsPublicKey,
    });

    groupCall.setOutgoingAudioMuted(!hasLocalAudio);
    groupCall.setOutgoingVideoMuted(!hasLocalVideo);

    if (hasLocalVideo) {
      drop(this.enableLocalCamera(CallMode.Group));
    }

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

    const logId = getLogId({ source: 'startOutgoingDirectCall', conversation });
    log.info(logId);

    muteStateChange.setIsMuted(!hasLocalAudio);

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

    try {
      await ensureSystemPermissions({ hasLocalAudio, hasLocalVideo });
    } catch (error) {
      log.error(
        `${logId}: failed to ensure system permissions`,
        Errors.toLogFormat(error)
      );
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

    // Set the camera disposition as we transition from the lobby to the outgoing call.
    this.#cameraEnabled = hasLocalVideo;

    // Set the initial state for outgoing media for the outgoing call.
    call.setOutgoingAudioMuted(!hasLocalAudio);
    call.setOutgoingVideoMuted(!hasLocalVideo);

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
        new GroupMemberInfo(uuidToBytes(member.aci), member.uuidCiphertext)
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
      membershipProof,
      this.#getGroupCallMembers(conversationId)
    );
  }

  public async peekCallLinkCall(
    roomId: string,
    rootKey: string | undefined,
    epoch: string | undefined
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
    const callLinkEpoch = epoch ? CallLinkEpoch.parse(epoch) : undefined;
    const authCredentialPresentation =
      await getCallLinkAuthCredentialPresentation(callLinkRootKey);

    const result = await RingRTC.peekCallLinkCall(
      this._sfuUrl,
      authCredentialPresentation.serialize(),
      callLinkRootKey,
      callLinkEpoch
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

    const logId = getLogId({ source: 'connectGroupCall', conversationId });
    log.info(logId);

    const groupIdBuffer = Bytes.fromBase64(groupId);

    let isRequestingMembershipProof = false;

    const outerGroupCall = RingRTC.getGroupCall(
      groupIdBuffer,
      this._sfuUrl,
      new Uint8Array(),
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
              groupCall.setMembershipProof(Bytes.fromString(proof));
            }
          } catch (err) {
            log.error(`${logId}: Failed to fetch membership proof`, err);
          } finally {
            isRequestingMembershipProof = false;
          }
        },
      }
    );

    if (!outerGroupCall) {
      // This should be very rare, likely due to RingRTC not being able to get a lock
      //   or memory or something like that.
      throw new Error(
        `${logId} Failed to get a group call instance; cannot start call`
      );
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
    callLinkEpoch,
    adminPasskey,
    endorsementsPublicKey,
  }: {
    roomId: string;
    authCredentialPresentation: CallLinkAuthCredentialPresentation;
    callLinkRootKey: CallLinkRootKey;
    callLinkEpoch: CallLinkEpoch | undefined;
    adminPasskey: Uint8Array | undefined;
    endorsementsPublicKey: Uint8Array;
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

    const logId = `connectCallLinkCall(${roomId}`;
    log.info(logId);

    if (!this._sfuUrl) {
      throw new Error(
        `${logId}: Missing SFU URL; not connecting group call link call`
      );
    }

    const outerGroupCall = RingRTC.getCallLinkCall(
      this._sfuUrl,
      endorsementsPublicKey,
      authCredentialPresentation.serialize(),
      callLinkRootKey,
      callLinkEpoch,
      adminPasskey,
      new Uint8Array(),
      AUDIO_LEVEL_INTERVAL_MS,
      this.#getGroupCallObserver(roomId, CallMode.Adhoc)
    );

    if (!outerGroupCall) {
      // This should be very rare, likely due to RingRTC not being able to get a lock
      //   or memory or something like that.
      throw new Error(
        `${logId}: Failed to get a group call instance; cannot start call`
      );
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
    const conversation = window.ConversationController.get(conversationId);
    if (!conversation) {
      log.error('joinGroupCall: Missing conversation; not joining group call');
      return;
    }

    const logId = getLogId({
      source: 'joinGroupCall',
      conversation,
    });
    log.info(logId);

    const { groupId, publicParams, secretParams } = conversation.attributes;
    if (!groupId || !publicParams || !secretParams) {
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

    await ensureSystemPermissions({ hasLocalAudio, hasLocalVideo });
    await this.#startDeviceReselectionTimer();

    const groupCall = this.connectGroupCall(conversationId, {
      groupId,
      publicParams,
      secretParams,
    });

    // Set the camera disposition as we transition from the lobby to the group call.
    this.#cameraEnabled = hasLocalVideo;

    groupCall.setOutgoingAudioMuted(!hasLocalAudio);
    groupCall.setOutgoingVideoMuted(!hasLocalVideo);
    drop(this.enableCaptureAndSend(groupCall, undefined, logId));

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
          if (localDeviceState.sharingScreen) {
            // Controlled by `#startPresenting`/`#stopPresenting`
          } else if (localDeviceState.videoMuted) {
            this.disableLocalVideo();
          } else {
            drop(this.enableCaptureAndSend(groupCall, undefined, logId));
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
      onRemoteMute: (_groupCall: GroupCall, demuxId: number) => {
        log.info('GroupCall#onRemoteMute');
        this.#reduxInterface?.setMutedBy({ mutedBy: demuxId });
      },
      onObservedRemoteMute: (
        _groupCall: GroupCall,
        sourceDemuxId: number,
        targetDemuxId: number
      ) => {
        log.info('GroupCall#onObservedRemoteMute');
        this.#reduxInterface?.onObservedRemoteMute({
          source: sourceDemuxId,
          target: targetDemuxId,
        });
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

    const ourAci = itemStorage.user.getCheckedAci();
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
      log.info(logId);

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
    epoch,
    adminKey,
    hasLocalAudio,
    hasLocalVideo,
  }: {
    roomId: string;
    rootKey: string;
    epoch: string | undefined;
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

    await ensureSystemPermissions({ hasLocalAudio, hasLocalVideo });
    await this.#startDeviceReselectionTimer();

    const callLinkRootKey = CallLinkRootKey.parse(rootKey);
    const callLinkEpoch = epoch ? CallLinkEpoch.parse(epoch) : undefined;
    const authCredentialPresentation =
      await getCallLinkAuthCredentialPresentation(callLinkRootKey);
    const adminPasskey = adminKey ? toAdminKeyBytes(adminKey) : undefined;
    const serverPublicParams = new ServerPublicParams(
      Buffer.from(window.getServerPublicParams(), 'base64')
    );
    const endorsementsPublicKey = serverPublicParams.getEndorsementPublicKey();

    // RingRTC reuses the same type GroupCall between Adhoc and Group calls.
    const groupCall = this.connectCallLinkCall({
      roomId,
      authCredentialPresentation,
      callLinkRootKey,
      callLinkEpoch,
      adminPasskey,
      endorsementsPublicKey,
    });

    // Set the camera disposition as we transition from the lobby to the call link call.
    this.#cameraEnabled = hasLocalVideo;

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

    groupCall.approveUser(uuidToBytes(aci));
  }

  public denyUser(conversationId: string, aci: AciString): void {
    const groupCall = this.#getGroupCall(conversationId);
    if (!groupCall) {
      throw new Error('Could not find matching call');
    }

    groupCall.denyUser(uuidToBytes(aci));
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

  #formatUserId(userId: Uint8Array): AciString | null {
    const uuid = bytesToUuid(userId);
    if (uuid && isAciString(uuid)) {
      return uuid;
    }

    log.error(
      'formatUserId: could not convert participant UUID Uint8Array to string'
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
            'formatGroupCallPeekInfoForRedux: device had no user ID; using fallback UUID'
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
            'formatGroupCallForRedux: could not convert remote participant UUID Uint8Array to string; using fallback UUID'
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

    const logId = getLogId({
      source: 'sendGroupCallUpdateMessage',
      conversation,
    });

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
    const logId = getLogId({
      source: 'CallingClass.acceptDirectCall',
      conversationId,
    });
    log.info(logId);

    const call = getOwn(this.#callsLookup, conversationId);
    if (!call || !(call instanceof Call)) {
      log.warn(`${logId}: Trying to accept a non-existent call`);
      return;
    }

    const callId = this.#getCallIdForConversation(conversationId);
    if (!callId) {
      log.warn(`${logId}: Trying to accept a non-existent call`);
      return;
    }

    const haveMediaPermissions = await this.#requestPermissions(asVideoCall);
    if (haveMediaPermissions) {
      await ensureSystemPermissions({
        hasLocalAudio: true,
        hasLocalVideo: asVideoCall,
      });
      await this.#startDeviceReselectionTimer();

      if (asVideoCall) {
        // Warm up the camera as soon as possible.
        drop(this.enableLocalCamera(CallMode.Direct));
      }

      // Set the starting camera disposition based on the type of call.
      this.#cameraEnabled = asVideoCall;

      // Set the initial state for outgoing media for the incoming call.
      call.setOutgoingAudioMuted(false);
      call.setOutgoingVideoMuted(!asVideoCall);

      RingRTC.accept(callId);
    } else {
      log.info(
        `${logId}: Permissions were denied, call not allowed, hanging up.`
      );
      RingRTC.hangup(callId);
    }
  }

  declineDirectCall(conversationId: string): void {
    const logId = getLogId({
      source: 'CallingClass.declineDirectCall',
      conversationId,
    });
    log.info(logId);

    const callId = this.#getCallIdForConversation(conversationId);
    if (!callId) {
      log.warn(`${logId}: Trying to decline a non-existent call`);
      return;
    }

    RingRTC.decline(callId);
  }

  declineGroupCall(conversationId: string, ringId: bigint): void {
    const logId = getLogId({
      source: 'CallingClass.declineGroupCall',
      conversationId,
    });
    log.info(logId);

    const groupId =
      window.ConversationController.get(conversationId)?.get('groupId');
    if (!groupId) {
      log.error(
        'declineGroupCall: could not find the group ID for that conversation'
      );
      return;
    }
    const groupIdBuffer = Bytes.fromBase64(groupId);

    RingRTC.cancelGroupRing(
      groupIdBuffer,
      ringId,
      RingCancelReason.DeclinedByUser
    );
  }

  hangup({
    conversationId,
    excludeRinging,
    reason,
  }: {
    conversationId: string;
    excludeRinging?: boolean;
    reason: string;
  }): void {
    const logId = getLogId({
      source: 'CallingClass.hangup',
      conversationId,
      additional: reason,
    });
    log.info(logId);

    const specificCall = getOwn(this.#callsLookup, conversationId);
    if (!specificCall) {
      log.error(`${logId}: Trying to hang up a non-existent call`);
    }

    ipcRenderer.send(
      'screen-share:status-change',
      ScreenShareStatus.Disconnected
    );

    const entries = Object.entries(this.#callsLookup);
    log.info(`${logId}: ${entries.length} call(s) to hang up...`);

    entries.forEach(([callConversationId, call]) => {
      log.info(`${logId}: Hanging up conversation ${callConversationId}`);
      if (call instanceof Call) {
        // Stop media immediately upon hangup.
        this.disableLocalVideo();
        this.videoRenderer.disable();
        call.setOutgoingAudioMuted(true);
        call.setOutgoingVideoMuted(true);

        if (
          excludeRinging &&
          call.state === CallState.Ringing &&
          call.isIncoming
        ) {
          log.info(`${logId}: Refusing to hang up call that is still ringing`);
        } else {
          RingRTC.hangup(call.callId);
        }
      } else if (call instanceof GroupCall) {
        // This ensures that we turn off our devices.
        call.setOutgoingAudioMuted(true);
        call.setOutgoingVideoMuted(true);
        call.disconnect();
      } else {
        throw missingCaseError(call);
      }
    });

    log.info(`${logId}: Done.`);
  }

  hangupAllCalls({
    excludeRinging,
    reason,
  }: {
    excludeRinging: boolean;
    reason: string;
  }): void {
    const conversationIds = Object.keys(this.#callsLookup);
    for (const conversationId of conversationIds) {
      this.hangup({ conversationId, excludeRinging, reason });
    }
  }

  setOutgoingAudio(conversationId: string, enabled: boolean): void {
    const call = getOwn(this.#callsLookup, conversationId);
    if (!call) {
      log.warn('Trying to set outgoing audio for a non-existent call');
      return;
    }

    if (call instanceof Call) {
      call.setOutgoingAudioMuted(!enabled);
    } else if (call instanceof GroupCall) {
      call.setOutgoingAudioMuted(!enabled);
    } else {
      throw missingCaseError(call);
    }

    muteStateChange.setIsMuted(!enabled);
  }

  setOutgoingAudioRemoteMuted(conversationId: string, source: number): void {
    const call = getOwn(this.#callsLookup, conversationId);
    if (!call) {
      log.warn('Trying to remote mute outgoing audio for a non-existent call');
      return;
    }

    if (call instanceof GroupCall) {
      call.setOutgoingAudioMutedRemotely(source);
    } else {
      log.warn('Trying to remote mute outgoing audio on a 1:1 call');
    }

    // Import: calling `setIsMuted` causes the subscriber in `initialize()` to
    // fire so make sure it is called *after* `setOutgoingAudioMutedRemotely`,
    // otherwise `setOutgoingAudioMuted` will be called first and we will lose
    // the `source` of the remote mute.
    muteStateChange.setIsMuted(true);
  }

  async setOutgoingVideo(
    conversationId: string,
    enabled: boolean
  ): Promise<void> {
    const call = getOwn(this.#callsLookup, conversationId);
    if (!call) {
      log.warn('Trying to set outgoing video for a non-existent call');
      return;
    }

    if (enabled) {
      // Make sure we have access to camera
      await window.reduxActions.globalModals.ensureSystemMediaPermissions(
        'camera',
        'call'
      );
    }

    this.#cameraEnabled = enabled;

    if (call instanceof Call) {
      if (enabled) {
        // Start sending video from the camera.
        await this.enableCaptureAndSend(call);
      } else {
        // Stop the camera.
        this.disableLocalVideo();
      }
      call.setOutgoingVideoMuted(!enabled);
    } else if (call instanceof GroupCall) {
      call.setOutgoingVideoMuted(!enabled);
    } else {
      throw missingCaseError(call);
    }
  }

  async #startPresenting(
    call: Call | GroupCall,
    mediaStream: MediaStream
  ): Promise<void> {
    if (call instanceof Call) {
      call.setOutgoingVideoIsScreenShare(true);
    } else if (call instanceof GroupCall) {
      call.setOutgoingVideoIsScreenShare(true);
      call.setPresenting(true);
    } else {
      throw missingCaseError(call);
    }

    // Start screen sharing stream
    await this.enableCaptureAndSend(call, {
      maxFramerate: REQUESTED_SCREEN_SHARE_FRAMERATE,
      maxHeight: REQUESTED_SCREEN_SHARE_HEIGHT,
      maxWidth: REQUESTED_SCREEN_SHARE_WIDTH,
      mediaStream,
      onEnded: () => {
        this.#reduxInterface?.cancelPresenting();
      },
    });

    // Enable the video transmission once the stream is running
    if (call instanceof Call) {
      call.setOutgoingVideoMuted(false);
    } else if (call instanceof GroupCall) {
      call.setOutgoingVideoMuted(false);
    } else {
      throw missingCaseError(call);
    }
  }

  async #stopPresenting(call: Call | GroupCall): Promise<void> {
    if (call instanceof Call) {
      // Disable video transmission first
      call.setOutgoingVideoMuted(!this.#cameraEnabled);

      // Stop screenshare
      call.setOutgoingVideoIsScreenShare(false);

      if (this.#cameraEnabled) {
        // Start sending video from the camera since it was enabled
        // prior to screensharing
        await this.enableCaptureAndSend(call);
      }
    } else if (call instanceof GroupCall) {
      // Ditto
      call.setOutgoingVideoMuted(!this.#cameraEnabled);

      call.setOutgoingVideoIsScreenShare(false);
      call.setPresenting(false);
    } else {
      throw missingCaseError(call);
    }
  }

  async setPresenting({
    conversationId,
    mediaStream,
    source,
    callLinkRootKey,
  }: SetPresentingOptionsType): Promise<void> {
    const call = getOwn(this.#callsLookup, conversationId);
    if (!call) {
      log.warn('Trying to set presenting for a non-existent call');
      return;
    }

    this.disableLocalVideo();

    const isPresenting = mediaStream != null;
    if (isPresenting) {
      await this.#startPresenting(call, mediaStream);
    } else {
      await this.#stopPresenting(call);
    }

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
          ? getAbsoluteTempPath(result.path)
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
        message: i18n('icu:calling__presenting--notification-body'),
        type: NotificationType.IsPresenting,
        sentAt: 0,
        silent: true,
        title: i18n('icu:calling__presenting--notification-title'),
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
        message: i18n(
          'icu:calling__presenting--reconnecting--notification-body'
        ),
        type: NotificationType.IsPresenting,
        sentAt: 0,
        silent: true,
        title: i18n(
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

  async #maybeUpdateDevices(newSettings: MediaDeviceSettings): Promise<void> {
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

  async #pollForMediaDevices(): Promise<void> {
    const newSettings = await this.getMediaDeviceSettings();
    return this.#maybeUpdateDevices(newSettings);
  }

  async #getAvailableIODevicesWithPrefetchedDevices(
    prefetchedMicrophones: Array<AudioDevice> | undefined,
    prefetchedSpeakers: Array<AudioDevice> | undefined
  ): Promise<AvailableIODevicesType> {
    const availableCameras = await this.#videoCapturer.enumerateDevices();
    const availableMicrophones =
      prefetchedMicrophones || RingRTC.getAudioInputs();
    const availableSpeakers = prefetchedSpeakers || RingRTC.getAudioOutputs();

    return {
      availableCameras,
      availableMicrophones,
      availableSpeakers,
    };
  }

  async getAvailableIODevices(): Promise<AvailableIODevicesType> {
    return this.#getAvailableIODevicesWithPrefetchedDevices(
      undefined,
      undefined
    );
  }

  async #getMediaDeviceSettingsWithPrefetchedDevices(
    prefetchedMicrophones: Array<AudioDevice> | undefined,
    prefetchedSpeakers: Array<AudioDevice> | undefined
  ): Promise<MediaDeviceSettings> {
    const { availableCameras, availableMicrophones, availableSpeakers } =
      await this.#getAvailableIODevicesWithPrefetchedDevices(
        prefetchedMicrophones,
        prefetchedSpeakers
      );

    const preferredMicrophone = getPreferredAudioInputDevice();
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

    const preferredSpeaker = getPreferredAudioOutputDevice();
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

    const preferredCamera = getPreferredVideoInputDevice();
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

  async getMediaDeviceSettings(): Promise<MediaDeviceSettings> {
    return this.#getMediaDeviceSettingsWithPrefetchedDevices(
      undefined,
      undefined
    );
  }

  setPreferredMicrophone(device: AudioDevice): void {
    log.info(
      'MediaDevice: setPreferredMicrophone',
      device.index,
      truncateForLogging(device.name)
    );
    drop(setPreferredAudioInputDevice(device));
    RingRTC.setAudioInput(device.index);
  }

  setPreferredSpeaker(device: AudioDevice): void {
    log.info(
      'MediaDevice: setPreferredSpeaker',
      device.index,
      truncateForLogging(device.name)
    );
    drop(setPreferredAudioOutputDevice(device));
    RingRTC.setAudioOutput(device.index);
  }

  async enableLocalCamera(mode: CallMode): Promise<void> {
    await window.reduxActions.globalModals.ensureSystemMediaPermissions(
      'camera',
      'call'
    );

    await this.#videoCapturer.enableCapture(
      mode === CallMode.Direct ? undefined : GROUP_CALL_OPTIONS
    );
  }

  async enableCaptureAndSend(
    call: GroupCall | Call,
    options = call instanceof GroupCall ? GROUP_CALL_OPTIONS : undefined,
    logId = 'enableCaptureAndSend'
  ): Promise<void> {
    try {
      await this.#videoCapturer.enableCaptureAndSend(call, options);
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
    drop(setPreferredVideoInputDevice(device));
    await this.#videoCapturer.setPreferredDevice(device);
  }

  async handleCallingMessage(
    envelope: ProcessedEnvelope,
    callingMessage: Proto.ICallMessage
  ): Promise<void> {
    const logId = `CallingClass.handleCallingMessage(${envelope.timestamp})`;
    log.info(logId);

    const enableIncomingCalls = getIncomingCallNotification();
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

    const senderIdentityRecord =
      await signalProtocolStore.getOrMigrateIdentityRecord(remoteUserId);
    if (!senderIdentityRecord) {
      log.error(
        `${logId}: Missing sender identity record; ignoring call message.`
      );
      return;
    }
    const senderIdentityKey = senderIdentityRecord.publicKey.subarray(1); // Ignore the type header, it is not used.

    const ourAci = itemStorage.user.getCheckedAci();

    const receiverIdentityRecord =
      signalProtocolStore.getIdentityRecord(ourAci);
    if (!receiverIdentityRecord) {
      log.error(
        `${logId}: Missing receiver identity record; ignoring call message.`
      );
      return;
    }
    const receiverIdentityKey = receiverIdentityRecord.publicKey.subarray(1); // Ignore the type header, it is not used.

    const conversation = window.ConversationController.get(remoteUserId);
    if (!conversation) {
      log.error(`${logId}: Missing conversation; ignoring call message.`);
      return;
    }

    if (
      callingMessage.offer &&
      !conversation.getAccepted({ ignoreEmptyConvo: true })
    ) {
      if (isPniString(envelope.destinationServiceId)) {
        log.info(
          `${logId}: Conversation was not approved by user; ` +
            'ignoring call message on PNI.'
        );
        return;
      }

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
      : undefined;

    const messageAgeSec = envelope.messageAgeSec ? envelope.messageAgeSec : 0;

    log.info(`${logId}: Handling in RingRTC`);

    RingRTC.handleCallingMessage(protoToCallingMessage(callingMessage), {
      remoteUserId,
      remoteUuid: sourceServiceId,
      remoteDeviceId,
      localDeviceId: this.#localDeviceId,
      ageSec: messageAgeSec,
      receivedAtCounter: envelope.receivedAtCounter,
      receivedAtDate: envelope.receivedAtDate,
      senderIdentityKey,
      receiverIdentityKey,
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

  async #requestPermissions(isVideoCall: boolean): Promise<boolean> {
    const microphonePermission = await requestMicrophonePermissions(true);
    if (microphonePermission) {
      if (isVideoCall) {
        return requestCameraPermissions();
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
    message.opaque.data = data;
    return this.#handleOutgoingSignaling(userId, message, urgency);
  }

  // Used to send a variety of group call messages, including the initial call message
  async #handleSendCallMessageToGroup(
    groupIdBytes: Uint8Array,
    data: Uint8Array,
    urgency: CallMessageUrgency,
    overrideRecipients: Array<Uint8Array> = []
  ): Promise<boolean> {
    const groupId = Bytes.toBase64(groupIdBytes);
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
    groupIdBytes: Uint8Array,
    ringId: bigint,
    ringerBytes: Uint8Array,
    update: RingUpdate
  ): Promise<void> {
    log.info(`handleGroupCallRingUpdate(): got ring update ${update}`);

    const groupId = Bytes.toBase64(groupIdBytes);

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

    const logId = getLogId({
      source: 'CallingClass.handleGroupCallRingUpdate',
      conversation,
    });
    log.info(logId);

    if (conversation.isBlocked()) {
      log.warn(`${logId}: is blocked`);
      return;
    }

    const ourAci = itemStorage.user.getCheckedAci();

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
      } else if (getIncomingCallNotification()) {
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

      const job = await conversationJobQueue.add({
        type: 'CallingMessage',
        conversationId: conversation.id,
        protoBase64,
        urgent,
      });

      const failAfterTimeout = async () => {
        await sleep(OUTGOING_SIGNALING_WAIT);
        throw new Error('Ran out of time');
      };
      await Promise.race([job.completion, failAfterTimeout()]);

      return true;
    } catch (err) {
      const errorString = Errors.toLogFormat(err);
      log.error(
        `handleOutgoingSignaling() failed to queue job or send: ${errorString}`
      );
      return false;
    }
  }

  // If we return null here, we hang up the call.
  async #handleIncomingCall(call: Call): Promise<boolean> {
    if (!this.#reduxInterface || !this.#localDeviceId) {
      log.error(
        'handleIncomingCall: Missing required objects, ignoring incoming call.'
      );
      return false;
    }

    const conversation = window.ConversationController.get(call.remoteUserId);
    if (!conversation) {
      log.error(
        'handleIncomingCall: Missing conversation, ignoring incoming call.'
      );
      return false;
    }

    const logId = getLogId({
      source: 'CallingClass.handleIncomingCall',
      conversation,
    });
    log.info(logId);

    if (conversation.isBlocked()) {
      log.warn(`${logId}: ${conversation.idForLogging()} is blocked`);
      return false;
    }
    try {
      // The peer must be 'trusted' before accepting a call from them.
      // This is mostly the safety number check, unverified meaning that they were
      // verified before but now they are not.
      const verifiedEnum = await conversation.safeGetVerified();
      if (verifiedEnum === signalProtocolStore.VerifiedStatus.UNVERIFIED) {
        log.info(`${logId}: Peer is not trusted, ignoring incoming call`);

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

      if (call.endedReason) {
        log.warn(
          `${logId}: Returning early, call ended with reason ${call.endedReason}`
        );
        this.#reduxInterface?.declineCall({ conversationId: conversation.id });
        return false;
      }

      this.#attachToCall(conversation, call);

      this.#reduxInterface.receiveIncomingDirectCall({
        conversationId: conversation.id,
        isVideoCall: call.isVideoCall,
      });

      log.warn(`${logId}: Returning true`);
      return true;
    } catch (err) {
      log.error(`${logId}: Ignoring incoming call: ${Errors.toLogFormat(err)}`);
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
      log.warn('handleAutoEndedIncomingCallRequest: Conversation not found');
      return;
    }

    const logId = getLogId({
      source: 'handleAutoEndedIncomingCallRequest',
      conversation,
    });
    log.info(logId);

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
      log.error(`${logId}: Unable to update redux for call`);
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
    const conversationId = conversation.id;
    this.#callsLookup[conversationId] = call;

    const reduxInterface = this.#reduxInterface;
    if (!reduxInterface) {
      return;
    }

    const logId = getLogId({
      source: 'CallingClass.attachToCall',
      conversation,
    });
    log.info(logId);

    let acceptedTime: number | null = null;

    // eslint-disable-next-line no-param-reassign
    call.handleStateChanged = async () => {
      if (call.state === CallState.Accepted) {
        acceptedTime = acceptedTime ?? Date.now();

        // Start rendering received video frames.
        this.videoRenderer.enable(call);
        if (this.#cameraEnabled) {
          // Start sending video from the camera (if not already).
          await this.enableCaptureAndSend(call);
        }
      }
      if (call.state === CallState.Ended) {
        // Stop media since the call has ended.
        this.disableLocalVideo();
        this.videoRenderer.disable();

        this.#stopDeviceReselectionTimer();
        this.#lastMediaDeviceSettings = undefined;
        delete this.#callsLookup[conversationId];
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
        conversationId,
        callState: call.state,
        callEndedReason: call.endedReason,
        acceptedTime,
      });
    };

    // eslint-disable-next-line no-param-reassign
    call.handleRemoteAudioEnabled = () => {
      reduxInterface.remoteAudioChange({
        conversationId,
        hasAudio: call.remoteAudioEnabled,
      });
    };
    // eslint-disable-next-line no-param-reassign
    call.handleRemoteVideoEnabled = () => {
      reduxInterface.remoteVideoChange({
        conversationId,
        hasVideo: call.remoteVideoEnabled,
      });
    };

    // eslint-disable-next-line no-param-reassign
    call.handleRemoteSharingScreen = () => {
      reduxInterface.remoteSharingScreenChange({
        conversationId,
        isSharingScreen: Boolean(call.remoteSharingScreen),
      });
    };

    // eslint-disable-next-line no-param-reassign
    call.handleAudioLevels = () => {
      reduxInterface.directCallAudioLevelsChange({
        conversationId,
        localAudioLevel: call.outgoingAudioLevel,
        remoteAudioLevel: call.remoteAudioLevel,
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
        ringrtcLog.info(`${fileName}:${line} ${message}`);
        break;
      case CallLogLevel.Warn:
        ringrtcLog.warn(`${fileName}:${line} ${message}`);
        break;
      case CallLogLevel.Error:
        ringrtcLog.error(`${fileName}:${line} ${message}`);
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
      result = await makeSfuRequest(url, httpMethod, headers, body);
    } catch (err) {
      if (err.code !== -1) {
        // WebAPI treats certain response codes as errors, but RingRTC still needs to
        // see them. It does not currently look at the response body, so we're giving
        // it an empty one.
        RingRTC.receivedHttpResponse(requestId, err.code, new Uint8Array(0));
      } else {
        log.error('handleSendHttpRequest: fetch failed with error', err);
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
    return this.#parseDeviceId(itemStorage.user.getDeviceId());
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

  async #getIceServers(): Promise<Array<IceServerType>> {
    function iceServerConfigToList(
      iceServerConfig: GetIceServersResultType
    ): Array<IceServerType> {
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

    const currentTime = Date.now();
    if (
      this.#iceServersCache &&
      currentTime < this.#iceServersCache.expirationTimestamp
    ) {
      // Use the cached value for iceServers.
      return this.#iceServersCache.iceServers;
    }

    let iceServers: Array<IceServerType> = [];
    // Set the default cache expiration time to now + 0.
    let expirationTimestamp = currentTime;

    const iceServerConfig = await getIceServers();

    // Advance the next expiration time to the minimum provided ttl value,
    // or if there were none, use 0 to disable the cache.
    const minTtl = (iceServerConfig.relays ?? []).reduce(
      (min, { ttl }) => Math.min(min, ttl ?? 0),
      Infinity
    );

    expirationTimestamp += minTtl !== Infinity ? minTtl * durations.SECOND : 0;

    // Prioritize ice servers with IPs to avoid DNS entries and only include
    // hostname with urlsWithIps.
    iceServers = iceServerConfigToList(iceServerConfig);

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

    if (iceServers.length > 0) {
      // Update the cached value for iceServers.
      this.#iceServersCache = { iceServers, expirationTimestamp };
    }
    return iceServers;
  }

  async #handleStartCall(call: Call): Promise<boolean> {
    const conversation = window.ConversationController.get(call.remoteUserId);
    if (!conversation) {
      log.error(
        'CallingClass.handleStartCall: Missing conversation, ignoring incoming call.'
      );
      return false;
    }

    const logId = getLogId({
      source: 'CallingClass.handleStartCall',
      conversation,
    });
    log.info(logId);

    if (call.endedReason) {
      log.warn(
        `${logId}: Returning early, call ended with reason ${call.endedReason}`
      );
      this.#reduxInterface?.declineCall({ conversationId: conversation.id });
      return false;
    }

    const iceServers = await this.#getIceServers();

    // We do this again, since getIceServers is a call that can take some time
    if (call.endedReason) {
      log.warn(
        `${logId}: Returning early, call ended with reason ${call.endedReason}`
      );
      this.#reduxInterface?.declineCall({ conversationId: conversation.id });
      return false;
    }

    const shouldRelayCalls = getAlwaysRelayCalls();

    // If the peer is not a Signal Connection, force IP hiding.
    const isContactUntrusted = !isSignalConnection(conversation.attributes);

    const callSettings = {
      iceServers,
      hideIp: shouldRelayCalls || isContactUntrusted,
      dataMode: DataMode.Normal,
      audioLevelsIntervalMillis: AUDIO_LEVEL_INTERVAL_MS,
    };

    log.info('CallingClass.handleStartCall(): Proceeding');
    RingRTC.proceed(call.callId, callSettings);

    return true;
  }

  async #handleOutputDeviceChanged(devices: Array<AudioDevice>): Promise<void> {
    const newSettings = await this.#getMediaDeviceSettingsWithPrefetchedDevices(
      undefined,
      devices
    );
    return this.#maybeUpdateDevices(newSettings);
  }

  async #handleInputDeviceChanged(devices: Array<AudioDevice>): Promise<void> {
    const newSettings = await this.#getMediaDeviceSettingsWithPrefetchedDevices(
      devices,
      undefined
    );
    return this.#maybeUpdateDevices(newSettings);
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
    let url: string | undefined;
    let absolutePath: string | undefined;

    switch (notificationService.getNotificationSetting()) {
      case NotificationSetting.Off: {
        return;
      }
      case NotificationSetting.NoNameOrMessage: {
        notificationTitle = FALLBACK_NOTIFICATION_TITLE;
        notificationMessage = i18n(
          'icu:calling__call-notification__started-by-someone'
        );
        break;
      }
      default: {
        // These fallbacks exist just in case something unexpected goes wrong.
        notificationTitle =
          conversation?.getTitle() || FALLBACK_NOTIFICATION_TITLE;
        notificationMessage = creatorConversation
          ? i18n('icu:calling__call-notification__started', {
              name: creatorConversation.getTitle(),
            })
          : i18n('icu:calling__call-notification__started-by-someone');
        const iconData = await conversation.getAvatarOrIdenticon();
        url = iconData.url;
        absolutePath = iconData.absolutePath;
        break;
      }
    }

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

  async notifyForCall(
    conversationId: string,
    title: string,
    isVideoCall: boolean
  ): Promise<void> {
    const shouldNotify =
      !window.SignalContext.activeWindowService.isActive() &&
      itemStorage.get('call-system-notification', true);

    if (!shouldNotify) {
      return;
    }

    const conversation = window.ConversationController.get(conversationId);
    if (!conversation) {
      log.error('notifyForCall: conversation not found');
      return;
    }

    let notificationTitle: string;
    let url: string | undefined;
    let absolutePath: string | undefined;

    const notificationSetting = notificationService.getNotificationSetting();
    switch (notificationSetting) {
      case NotificationSetting.Off: {
        return;
      }
      case NotificationSetting.NoNameOrMessage: {
        notificationTitle = FALLBACK_NOTIFICATION_TITLE;
        break;
      }
      case NotificationSetting.NameOnly:
      case NotificationSetting.NameAndMessage: {
        notificationTitle = title;

        const iconData = await conversation.getAvatarOrIdenticon();
        url = iconData.url;
        absolutePath = iconData.absolutePath;
        break;
      }
      default: {
        log.error(Errors.toLogFormat(missingCaseError(notificationSetting)));
        notificationTitle = FALLBACK_NOTIFICATION_TITLE;
        break;
      }
    }

    notificationService.notify({
      conversationId,
      title: notificationTitle,
      iconPath: absolutePath,
      iconUrl: url,
      message: isVideoCall
        ? i18n('icu:incomingVideoCall')
        : i18n('icu:incomingAudioCall'),
      sentAt: 0,
      // The ringtone plays so we don't need sound for the notification
      silent: true,
      type: NotificationType.IncomingCall,
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
