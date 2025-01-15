// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThunkAction, ThunkDispatch } from 'redux-thunk';
import {
  hasScreenCapturePermission,
  openSystemPreferences,
} from 'mac-screen-capture-permissions';
import { isSupported as isNativeMacScreenShareSupported } from '@indutny/mac-screen-share';
import { omit } from 'lodash';
import type { ReadonlyDeep } from 'type-fest';
import {
  CallLinkRootKey,
  GroupCallEndReason,
  type Reaction as CallReaction,
} from '@signalapp/ringrtc';
import { getOwn } from '../../util/getOwn';
import * as Errors from '../../types/errors';
import { getIntl, getPlatform } from '../selectors/user';
import { isConversationTooBigToRing } from '../../conversations/isConversationTooBigToRing';
import { missingCaseError } from '../../util/missingCaseError';
import { drop } from '../../util/drop';
import {
  DesktopCapturer,
  type DesktopCapturerBaton,
} from '../../util/desktopCapturer';
import { calling } from '../../services/calling';
import { truncateAudioLevel } from '../../calling/truncateAudioLevel';
import type { StateType as RootStateType } from '../reducer';
import type {
  ActiveCallReaction,
  ActiveCallReactionsType,
  ChangeIODevicePayloadType,
  GroupCallVideoRequest,
  MediaDeviceSettings,
  PresentedSource,
  PresentableSource,
} from '../../types/Calling';
import {
  isCallLinkAdmin,
  type CallLinkRestrictions,
  type CallLinkStateType,
  type CallLinkType,
} from '../../types/CallLink';
import {
  CALLING_REACTIONS_LIFETIME,
  MAX_CALLING_REACTIONS,
  CallEndedReason,
  CallingDeviceType,
  CallViewMode,
  CallState,
  GroupCallConnectionState,
  GroupCallJoinState,
} from '../../types/Calling';
import { CallMode } from '../../types/CallDisposition';
import { callingTones } from '../../util/callingTones';
import { requestCameraPermissions } from '../../util/callingPermissions';
import {
  CALL_LINK_DEFAULT_STATE,
  toAdminKeyBytes,
  toCallHistoryFromUnusedCallLink,
} from '../../util/callLinks';
import { getRoomIdFromRootKey } from '../../util/callLinksRingrtc';
import { sendCallLinkUpdateSync } from '../../util/sendCallLinkUpdateSync';
import { sleep } from '../../util/sleep';
import { LatestQueue } from '../../util/LatestQueue';
import type { AciString, ServiceIdString } from '../../types/ServiceId';
import type {
  ConversationsUpdatedActionType,
  ConversationRemovedActionType,
} from './conversations';
import { getConversationCallMode, updateLastMessage } from './conversations';
import * as log from '../../logging/log';
import { strictAssert } from '../../util/assert';
import { waitForOnline } from '../../util/waitForOnline';
import * as mapUtil from '../../util/mapUtil';
import { isCallSafe } from '../../util/isCallSafe';
import { isDirectConversation } from '../../util/whatTypeOfConversation';
import { SHOW_TOAST } from './toast';
import { ToastType } from '../../types/Toast';
import type { ShowToastActionType } from './toast';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import { useBoundActions } from '../../hooks/useBoundActions';
import {
  isAnybodyElseInGroupCall,
  isAnybodyInGroupCall,
  MAX_CALL_PARTICIPANTS_FOR_DEFAULT_MUTE,
} from './callingHelpers';
import { SafetyNumberChangeSource } from '../../components/SafetyNumberChangeDialog';
import {
  isGroupOrAdhocCallMode,
  isGroupOrAdhocCallState,
} from '../../util/isGroupOrAdhocCall';
import type {
  ShowErrorModalActionType,
  ToggleConfirmLeaveCallModalActionType,
} from './globalModals';
import { SHOW_ERROR_MODAL, toggleConfirmLeaveCallModal } from './globalModals';
import { ButtonVariant } from '../../components/Button';
import { getConversationIdForLogging } from '../../util/idForLogging';
import { DataReader, DataWriter } from '../../sql/Client';
import { isAciString } from '../../util/isAciString';
import type { CallHistoryAdd } from './callHistory';
import { addCallHistory, reloadCallHistory } from './callHistory';
import { saveDraftRecordingIfNeeded } from './composer';
import type { CallHistoryDetails } from '../../types/CallDisposition';
import type { StartCallData } from '../../components/ConfirmLeaveCallModal';
import {
  getCallLinksByRoomId,
  getPresentingSource,
} from '../selectors/calling';
import { storageServiceUploadJob } from '../../services/storage';
import { CallLinkFinalizeDeleteManager } from '../../jobs/CallLinkFinalizeDeleteManager';
import { callLinkRefreshJobQueue } from '../../jobs/callLinkRefreshJobQueue';

// State

export type GroupCallPeekInfoType = ReadonlyDeep<{
  acis: Array<AciString>;
  pendingAcis: Array<AciString>;
  creatorAci?: AciString;
  eraId?: string;
  maxDevices: number;
  deviceCount: number;
}>;

// eslint-disable-next-line local-rules/type-alias-readonlydeep
export type GroupCallParticipantInfoType = {
  aci: AciString;
  addedTime?: number;
  demuxId: number;
  hasRemoteAudio: boolean;
  hasRemoteVideo: boolean;
  mediaKeysReceived: boolean;
  presenting: boolean;
  sharingScreen: boolean;
  speakerTime?: number;
  videoAspectRatio: number;
};

// eslint-disable-next-line local-rules/type-alias-readonlydeep
export type DirectCallStateType = {
  callMode: CallMode.Direct;
  conversationId: string;
  callState?: CallState;
  callEndedReason?: CallEndedReason;
  isIncoming: boolean;
  isSharingScreen?: boolean;
  isVideoCall: boolean;
  hasRemoteVideo?: boolean;
};

type GroupCallRingStateType = ReadonlyDeep<
  | {
      ringId?: undefined;
      ringerAci?: undefined;
    }
  | {
      ringId: bigint;
      ringerAci: AciString;
    }
>;

// eslint-disable-next-line local-rules/type-alias-readonlydeep
export type GroupCallStateType = {
  callMode: CallMode.Group | CallMode.Adhoc;
  conversationId: string;
  connectionState: GroupCallConnectionState;
  localDemuxId: number | undefined;
  joinState: GroupCallJoinState;
  peekInfo?: GroupCallPeekInfoType;
  raisedHands?: Array<number>;
  remoteParticipants: Array<GroupCallParticipantInfoType>;
  remoteAudioLevels?: Map<number, number>;
} & GroupCallRingStateType;

// eslint-disable-next-line local-rules/type-alias-readonlydeep
export type ActiveCallStateType = {
  state: 'Active';
  callMode: CallMode;
  conversationId: string;
  hasLocalAudio: boolean;
  hasLocalVideo: boolean;
  localAudioLevel: number;
  viewMode: CallViewMode;
  viewModeBeforePresentation?: CallViewMode;
  joinedAt: number | null;
  outgoingRing: boolean;
  pip: boolean;
  presentingSource?: PresentedSource;
  presentingSourcesAvailable?: ReadonlyArray<PresentableSource>;
  settingsDialogOpen: boolean;
  showNeedsScreenRecordingPermissionsWarning?: boolean;
  showParticipantsList: boolean;
  suggestLowerHand?: boolean;
  reactions?: ActiveCallReactionsType;
};
export type WaitingCallStateType = ReadonlyDeep<{
  state: 'Waiting';
  conversationId: string;
}>;

// eslint-disable-next-line local-rules/type-alias-readonlydeep
export type CallsByConversationType = {
  [conversationId: string]: DirectCallStateType | GroupCallStateType;
};

// eslint-disable-next-line local-rules/type-alias-readonlydeep
export type AdhocCallsType = {
  [roomId: string]: GroupCallStateType;
};

export type CallLinksByRoomIdType = ReadonlyDeep<{
  [roomId: string]: CallLinkType;
}>;

// eslint-disable-next-line local-rules/type-alias-readonlydeep
export type CallingStateType = MediaDeviceSettings & {
  callsByConversation: CallsByConversationType;
  adhocCalls: AdhocCallsType;
  callLinks: CallLinksByRoomIdType;
  activeCallState?: ActiveCallStateType | WaitingCallStateType;
  capturerBaton?: DesktopCapturerBaton;
};

export type AcceptCallType = ReadonlyDeep<{
  conversationId: string;
  asVideoCall: boolean;
}>;

export type CallStateChangeType = ReadonlyDeep<{
  conversationId: string;
  acceptedTime: number | null;
  callState: CallState;
  callEndedReason?: CallEndedReason;
}>;

export type CancelCallType = ReadonlyDeep<{
  conversationId: string;
}>;

type CancelIncomingGroupCallRingType = ReadonlyDeep<{
  conversationId: string;
  ringId: bigint;
}>;

export type DeclineCallType = ReadonlyDeep<{
  conversationId: string;
}>;

// eslint-disable-next-line local-rules/type-alias-readonlydeep
type GroupCallStateChangeArgumentType = {
  callMode: CallMode.Group | CallMode.Adhoc;
  connectionState: GroupCallConnectionState;
  conversationId: string;
  hasLocalAudio: boolean;
  hasLocalVideo: boolean;
  joinState: GroupCallJoinState;
  localDemuxId: number | undefined;
  peekInfo?: GroupCallPeekInfoType;
  remoteParticipants: Array<GroupCallParticipantInfoType>;
};

type GroupCallReactionsReceivedArgumentType = ReadonlyDeep<{
  callMode: CallMode;
  conversationId: string;
  reactions: Array<CallReaction>;
}>;

// eslint-disable-next-line local-rules/type-alias-readonlydeep
type GroupCallStateChangeActionPayloadType =
  GroupCallStateChangeArgumentType & {
    ourAci: AciString;
  };

type HandleCallLinkUpdateActionPayloadType = ReadonlyDeep<{
  callLink: CallLinkType;
}>;

type HandleCallLinkDeleteActionPayloadType = ReadonlyDeep<{
  roomId: string;
}>;

type HangUpActionPayloadType = ReadonlyDeep<{
  conversationId: string;
}>;

export type HandleCallLinkUpdateType = ReadonlyDeep<{
  rootKey: string;
  adminKey: string | null;
}>;

export type HandleCallLinkDeleteType = ReadonlyDeep<{
  roomId: string;
}>;

export type IncomingDirectCallType = ReadonlyDeep<{
  conversationId: string;
  isVideoCall: boolean;
}>;

type IncomingGroupCallType = ReadonlyDeep<{
  conversationId: string;
  ringId: bigint;
  ringerAci: AciString;
}>;

export type SendGroupCallRaiseHandType = ReadonlyDeep<{
  conversationId: string;
  raise: boolean;
}>;

export type SendGroupCallReactionType = ReadonlyDeep<{
  callMode: CallMode;
  conversationId: string;
  value: string;
}>;
type SendGroupCallReactionLocalCopyType = ReadonlyDeep<{
  callMode: CallMode;
  conversationId: string;
  value: string;
  timestamp: number;
}>;

export type PeekNotConnectedGroupCallType = ReadonlyDeep<{
  callMode: CallMode.Group | CallMode.Adhoc;
  conversationId: string;
}>;

type StartDirectCallType = ReadonlyDeep<{
  conversationId: string;
  hasLocalAudio: boolean;
  hasLocalVideo: boolean;
}>;

export type StartCallType = ReadonlyDeep<
  StartDirectCallType & {
    callMode: CallMode.Direct | CallMode.Group | CallMode.Adhoc;
  }
>;

export type RemoteVideoChangeType = ReadonlyDeep<{
  conversationId: string;
  hasVideo: boolean;
}>;

type RemoteSharingScreenChangeType = ReadonlyDeep<{
  conversationId: string;
  isSharingScreen: boolean;
}>;

export type RemoveClientType = ReadonlyDeep<{
  demuxId: number;
}>;

export type SetLocalAudioType = ReadonlyDeep<{
  enabled: boolean;
}>;

export type SetLocalVideoType = ReadonlyDeep<{
  enabled: boolean;
}>;

export type SetGroupCallVideoRequestType = ReadonlyDeep<{
  conversationId: string;
  resolutions: Array<GroupCallVideoRequest>;
  speakerHeight: number;
}>;

export type StartCallingLobbyType = ReadonlyDeep<{
  conversationId: string;
  isVideoCall: boolean;
}>;

export type StartCallLinkLobbyType = ReadonlyDeep<{
  rootKey: string;
}>;

export type StartCallLinkLobbyByRoomIdType = ReadonlyDeep<{
  roomId: string;
}>;

type StartCallLinkLobbyThunkActionType = ReadonlyDeep<
  ThunkAction<
    void,
    RootStateType,
    unknown,
    StartCallLinkLobbyActionType | ShowErrorModalActionType
  >
>;

// eslint-disable-next-line local-rules/type-alias-readonlydeep
type StartCallingLobbyPayloadType =
  | {
      callMode: CallMode.Direct;
      conversationId: string;
      hasLocalAudio: boolean;
      hasLocalVideo: boolean;
    }
  | {
      callMode: CallMode.Group;
      conversationId: string;
      connectionState: GroupCallConnectionState;
      joinState: GroupCallJoinState;
      hasLocalAudio: boolean;
      hasLocalVideo: boolean;
      isConversationTooBigToRing: boolean;
      peekInfo?: GroupCallPeekInfoType;
      remoteParticipants: Array<GroupCallParticipantInfoType>;
    };

// eslint-disable-next-line local-rules/type-alias-readonlydeep
type StartCallLinkLobbyPayloadType = {
  callMode: CallMode.Adhoc;
  conversationId: string;
  connectionState: GroupCallConnectionState;
  joinState: GroupCallJoinState;
  hasLocalAudio: boolean;
  hasLocalVideo: boolean;
  isConversationTooBigToRing: boolean;
  peekInfo?: GroupCallPeekInfoType;
  remoteParticipants: Array<GroupCallParticipantInfoType>;
  callLinkState: CallLinkStateType;
  callLinkRoomId: string;
  callLinkRootKey: string;
};

// eslint-disable-next-line local-rules/type-alias-readonlydeep
export type SetRendererCanvasType = {
  element: React.RefObject<HTMLCanvasElement> | undefined;
};

// Helpers

export const getActiveCall = ({
  activeCallState,
  adhocCalls,
  callsByConversation,
}: CallingStateType): undefined | DirectCallStateType | GroupCallStateType => {
  if (!activeCallState) {
    return;
  }

  const { state, conversationId } = activeCallState;
  if (state === 'Waiting') {
    return;
  }

  return activeCallState.callMode === CallMode.Adhoc
    ? getOwn(adhocCalls, conversationId)
    : getOwn(callsByConversation, conversationId);
};

const getGroupCallRingState = (
  call: Readonly<undefined | GroupCallStateType>
): GroupCallRingStateType =>
  call?.ringId === undefined
    ? {}
    : { ringId: call.ringId, ringerAci: call.ringerAci };

// We might call this function many times in rapid succession (for example, if lots of
//   people are joining and leaving at once). We want to make sure to update eventually
//   (if people join and leave for an hour, we don't want you to have to wait an hour to
//   get an update), and we also don't want to update too often. That's why we use a
//   "latest queue".
const peekQueueByConversation = new Map<string, LatestQueue>();
const doGroupCallPeek = ({
  conversationId,
  callMode,
  dispatch,
  getState,
}: {
  conversationId: string;
  callMode: CallMode.Group | CallMode.Adhoc;
  dispatch: ThunkDispatch<
    RootStateType,
    unknown,
    PeekGroupCallFulfilledActionType
  >;
  getState: () => RootStateType;
}) => {
  let logId: string;
  if (callMode === CallMode.Group) {
    const conversation = getOwn(
      getState().conversations.conversationLookup,
      conversationId
    );
    if (
      !conversation ||
      getConversationCallMode(conversation) !== CallMode.Group
    ) {
      return;
    }

    logId = getConversationIdForLogging(conversation);
  } else {
    const callLink = getOwn(getState().calling.callLinks, conversationId);
    if (!callLink) {
      return;
    }
    logId = `adhoc(${conversationId})`;
  }

  let queue = peekQueueByConversation.get(conversationId);
  if (!queue) {
    queue = new LatestQueue();
    queue.onceEmpty(() => {
      peekQueueByConversation.delete(conversationId);
    });
    peekQueueByConversation.set(conversationId, queue);
  }

  queue.add(async () => {
    const state = getState();

    // We make sure we're not trying to peek at a connected (or connecting, or
    //   reconnecting) call. Because this is asynchronous, it's possible that the call
    //   will connect by the time we dispatch, so we also need to do a similar check in
    //   the reducer.
    const existingCall = getOwn(
      state.calling.callsByConversation,
      conversationId
    );
    if (
      existingCall != null &&
      isGroupOrAdhocCallState(existingCall) &&
      existingCall.connectionState !== GroupCallConnectionState.NotConnected
    ) {
      log.info(
        `doGroupCallPeek/groupv2: Not peeking because the connection state is ${existingCall.connectionState}`
      );
      return;
    }

    // If we peek right after receiving the message, we may get outdated information.
    //   This is most noticeable when someone leaves. We add a delay and then make sure
    //   to only be peeking once.
    const { server } = window.textsecure;
    if (!server) {
      log.error('doGroupCallPeek: no textsecure server');
      return;
    }
    await Promise.all([sleep(1000), waitForOnline()]);

    let peekInfo = null;
    try {
      if (callMode === CallMode.Group) {
        peekInfo = await calling.peekGroupCall(conversationId);
      } else {
        // For adhoc calls, conversationId is actually a roomId.
        const rootKey: string | undefined = getOwn(
          state.calling.callLinks,
          conversationId
        )?.rootKey;
        peekInfo = await calling.peekCallLinkCall(conversationId, rootKey);
      }
    } catch (err) {
      log.error('Group call peeking failed', Errors.toLogFormat(err));
      return;
    }

    if (!peekInfo) {
      return;
    }

    log.info(`doGroupCallPeek/${logId}: Found ${peekInfo.deviceCount} devices`);

    const joinState = isGroupOrAdhocCallState(existingCall)
      ? existingCall.joinState
      : null;
    if (callMode === CallMode.Group) {
      try {
        await calling.updateCallHistoryForGroupCallOnPeek(
          conversationId,
          joinState,
          peekInfo
        );
      } catch (error) {
        log.error(
          'doGroupCallPeek/groupv2: Failed to update call history',
          Errors.toLogFormat(error)
        );
      }

      dispatch(updateLastMessage(conversationId));
    } else if (callMode === CallMode.Adhoc) {
      await calling.updateCallHistoryForAdhocCall(
        conversationId,
        joinState,
        peekInfo
      );
    }

    const formattedPeekInfo = calling.formatGroupCallPeekInfoForRedux(peekInfo);

    dispatch({
      type: PEEK_GROUP_CALL_FULFILLED,
      payload: {
        callMode,
        conversationId,
        peekInfo: formattedPeekInfo,
      },
    });
  });
};

// Actions

const ACCEPT_CALL_PENDING = 'calling/ACCEPT_CALL_PENDING';
const APPROVE_USER = 'calling/APPROVE_USER';
const BLOCK_CLIENT = 'calling/BLOCK_CLIENT';
const CANCEL_CALL = 'calling/CANCEL_CALL';
const CANCEL_INCOMING_GROUP_CALL_RING =
  'calling/CANCEL_INCOMING_GROUP_CALL_RING';
const CHANGE_CALL_VIEW = 'calling/CHANGE_CALL_VIEW';
const DENY_USER = 'calling/DENY_USER';
const START_CALLING_LOBBY = 'calling/START_CALLING_LOBBY';
const WAITING_FOR_CALLING_LOBBY = 'calling/WAITING_FOR_CALLING_LOBBY';
const START_CALL_LINK_LOBBY = 'calling/START_CALL_LINK_LOBBY';
const WAITING_FOR_CALL_LINK_LOBBY = 'calling/WAITING_FOR_CALL_LINK_LOBBY';
const CALL_LOBBY_FAILED = 'calling/CALL_LOBBY_FAILED';
const CALL_STATE_CHANGE_FULFILLED = 'calling/CALL_STATE_CHANGE_FULFILLED';
const CHANGE_IO_DEVICE_FULFILLED = 'calling/CHANGE_IO_DEVICE_FULFILLED';
const CLOSE_NEED_PERMISSION_SCREEN = 'calling/CLOSE_NEED_PERMISSION_SCREEN';
const DECLINE_DIRECT_CALL = 'calling/DECLINE_DIRECT_CALL';
const GROUP_CALL_AUDIO_LEVELS_CHANGE = 'calling/GROUP_CALL_AUDIO_LEVELS_CHANGE';
const GROUP_CALL_ENDED = 'calling/GROUP_CALL_ENDED';
const GROUP_CALL_RAISED_HANDS_CHANGE = 'calling/GROUP_CALL_RAISED_HANDS_CHANGE';
const GROUP_CALL_STATE_CHANGE = 'calling/GROUP_CALL_STATE_CHANGE';
const GROUP_CALL_REACTIONS_RECEIVED = 'calling/GROUP_CALL_REACTIONS_RECEIVED';
const GROUP_CALL_REACTIONS_EXPIRED = 'calling/GROUP_CALL_REACTIONS_EXPIRED';
const HANDLE_CALL_LINK_UPDATE = 'calling/HANDLE_CALL_LINK_UPDATE';
const HANDLE_CALL_LINK_DELETE = 'calling/HANDLE_CALL_LINK_DELETE';
const HANG_UP = 'calling/HANG_UP';
const INCOMING_DIRECT_CALL = 'calling/INCOMING_DIRECT_CALL';
const INCOMING_GROUP_CALL = 'calling/INCOMING_GROUP_CALL';
const OUTGOING_CALL = 'calling/OUTGOING_CALL';
const PEEK_GROUP_CALL_FULFILLED = 'calling/PEEK_GROUP_CALL_FULFILLED';
const RAISE_HAND_GROUP_CALL = 'calling/RAISE_HAND_GROUP_CALL';
const REFRESH_IO_DEVICES = 'calling/REFRESH_IO_DEVICES';
const REMOTE_SHARING_SCREEN_CHANGE = 'calling/REMOTE_SHARING_SCREEN_CHANGE';
const REMOTE_VIDEO_CHANGE = 'calling/REMOTE_VIDEO_CHANGE';
const REMOVE_CLIENT = 'calling/REMOVE_CLIENT';
const RETURN_TO_ACTIVE_CALL = 'calling/RETURN_TO_ACTIVE_CALL';
const SELECT_PRESENTING_SOURCE = 'calling/SELECT_PRESENTING_SOURCE';
const SEND_GROUP_CALL_REACTION = 'calling/SEND_GROUP_CALL_REACTION';
const SET_LOCAL_AUDIO_FULFILLED = 'calling/SET_LOCAL_AUDIO_FULFILLED';
const SET_LOCAL_VIDEO_FULFILLED = 'calling/SET_LOCAL_VIDEO_FULFILLED';
const SET_OUTGOING_RING = 'calling/SET_OUTGOING_RING';
const SET_PRESENTING = 'calling/SET_PRESENTING';
const SET_PRESENTING_SOURCES = 'calling/SET_PRESENTING_SOURCES';
const SET_CAPTURER_BATON = 'calling/SET_CAPTURER_BATON';
const SUGGEST_LOWER_HAND = 'calling/SUGGEST_LOWER_HAND';
const TOGGLE_NEEDS_SCREEN_RECORDING_PERMISSIONS =
  'calling/TOGGLE_NEEDS_SCREEN_RECORDING_PERMISSIONS';
const START_DIRECT_CALL = 'calling/START_DIRECT_CALL';
const TOGGLE_PARTICIPANTS = 'calling/TOGGLE_PARTICIPANTS';
const TOGGLE_PIP = 'calling/TOGGLE_PIP';
const TOGGLE_SETTINGS = 'calling/TOGGLE_SETTINGS';
const SWITCH_TO_PRESENTATION_VIEW = 'calling/SWITCH_TO_PRESENTATION_VIEW';
const SWITCH_FROM_PRESENTATION_VIEW = 'calling/SWITCH_FROM_PRESENTATION_VIEW';

type AcceptCallPendingActionType = ReadonlyDeep<{
  type: 'calling/ACCEPT_CALL_PENDING';
  payload: AcceptCallType;
}>;

type ApproveUserActionType = ReadonlyDeep<{
  type: 'calling/APPROVE_USER';
}>;

type CancelCallActionType = ReadonlyDeep<{
  type: 'calling/CANCEL_CALL';
}>;

type CancelIncomingGroupCallRingActionType = ReadonlyDeep<{
  type: 'calling/CANCEL_INCOMING_GROUP_CALL_RING';
  payload: CancelIncomingGroupCallRingType;
}>;

type DenyUserActionType = ReadonlyDeep<{
  type: 'calling/DENY_USER';
}>;

// eslint-disable-next-line local-rules/type-alias-readonlydeep
type StartCallingLobbyActionType = {
  type: typeof START_CALLING_LOBBY;
  payload: StartCallingLobbyPayloadType;
};

type WaitingForCallingLobbyActionType = ReadonlyDeep<{
  type: typeof WAITING_FOR_CALLING_LOBBY;
  payload: { conversationId: string };
}>;

// eslint-disable-next-line local-rules/type-alias-readonlydeep
type StartCallLinkLobbyActionType = {
  type: typeof START_CALL_LINK_LOBBY;
  payload: StartCallLinkLobbyPayloadType;
};

type WaitingForCallLinkLobbyActionType = ReadonlyDeep<{
  type: typeof WAITING_FOR_CALL_LINK_LOBBY;
  payload: { roomId: string };
}>;
type CallLobbyFailedActionType = ReadonlyDeep<{
  type: typeof CALL_LOBBY_FAILED;
  payload: { conversationId: string };
}>;

type CallStateChangeFulfilledActionType = ReadonlyDeep<{
  type: 'calling/CALL_STATE_CHANGE_FULFILLED';
  payload: CallStateChangeType;
}>;

type ChangeIODeviceFulfilledActionType = ReadonlyDeep<{
  type: 'calling/CHANGE_IO_DEVICE_FULFILLED';
  payload: ChangeIODevicePayloadType;
}>;

type CloseNeedPermissionScreenActionType = ReadonlyDeep<{
  type: 'calling/CLOSE_NEED_PERMISSION_SCREEN';
  payload: null;
}>;

type DeclineCallActionType = ReadonlyDeep<{
  type: 'calling/DECLINE_DIRECT_CALL';
  payload: DeclineCallType;
}>;

type GroupCallAudioLevelsChangeActionPayloadType = ReadonlyDeep<{
  callMode: CallMode;
  conversationId: string;
  localAudioLevel: number;
  remoteDeviceStates: ReadonlyArray<{ audioLevel: number; demuxId: number }>;
}>;

type GroupCallAudioLevelsChangeActionType = ReadonlyDeep<{
  type: 'calling/GROUP_CALL_AUDIO_LEVELS_CHANGE';
  payload: GroupCallAudioLevelsChangeActionPayloadType;
}>;

type GroupCallEndedActionPayloadType = ReadonlyDeep<{
  conversationId: string;
  endedReason: GroupCallEndReason;
}>;

export type GroupCallEndedActionType = ReadonlyDeep<{
  type: 'calling/GROUP_CALL_ENDED';
  payload: GroupCallEndedActionPayloadType;
}>;

type GroupCallRaisedHandsChangeActionPayloadType = ReadonlyDeep<{
  callMode: CallMode;
  conversationId: string;
  raisedHands: ReadonlyArray<number>;
}>;

type GroupCallRaisedHandsChangeActionType = ReadonlyDeep<{
  type: 'calling/GROUP_CALL_RAISED_HANDS_CHANGE';
  payload: GroupCallRaisedHandsChangeActionPayloadType;
}>;

// eslint-disable-next-line local-rules/type-alias-readonlydeep
export type GroupCallStateChangeActionType = {
  type: 'calling/GROUP_CALL_STATE_CHANGE';
  payload: GroupCallStateChangeActionPayloadType;
};

type GroupCallReactionsReceivedActionPayloadType = ReadonlyDeep<{
  callMode: CallMode;
  conversationId: string;
  reactions: Array<CallReaction>;
  timestamp: number;
}>;

type GroupCallReactionsExpiredActionPayloadType = ReadonlyDeep<{
  conversationId: string;
  timestamp: number;
}>;

export type GroupCallReactionsReceivedActionType = ReadonlyDeep<{
  type: 'calling/GROUP_CALL_REACTIONS_RECEIVED';
  payload: GroupCallReactionsReceivedActionPayloadType;
}>;

type GroupCallReactionsExpiredActionType = ReadonlyDeep<{
  type: 'calling/GROUP_CALL_REACTIONS_EXPIRED';
  payload: GroupCallReactionsExpiredActionPayloadType;
}>;

type HandleCallLinkUpdateActionType = ReadonlyDeep<{
  type: typeof HANDLE_CALL_LINK_UPDATE;
  payload: HandleCallLinkUpdateActionPayloadType;
}>;

type HandleCallLinkDeleteActionType = ReadonlyDeep<{
  type: typeof HANDLE_CALL_LINK_DELETE;
  payload: HandleCallLinkDeleteActionPayloadType;
}>;

type HangUpActionType = ReadonlyDeep<{
  type: 'calling/HANG_UP';
  payload: HangUpActionPayloadType;
}>;

type IncomingDirectCallActionType = ReadonlyDeep<{
  type: 'calling/INCOMING_DIRECT_CALL';
  payload: IncomingDirectCallType;
}>;

type IncomingGroupCallActionType = ReadonlyDeep<{
  type: 'calling/INCOMING_GROUP_CALL';
  payload: IncomingGroupCallType;
}>;

type SendGroupCallRaiseHandActionType = ReadonlyDeep<{
  type: 'calling/RAISE_HAND_GROUP_CALL';
  payload: SendGroupCallRaiseHandType;
}>;

export type SendGroupCallReactionActionType = ReadonlyDeep<{
  type: 'calling/SEND_GROUP_CALL_REACTION';
  payload: SendGroupCallReactionLocalCopyType;
}>;

type OutgoingCallActionType = ReadonlyDeep<{
  type: 'calling/OUTGOING_CALL';
  payload: StartDirectCallType;
}>;

export type PeekGroupCallFulfilledActionType = ReadonlyDeep<{
  type: 'calling/PEEK_GROUP_CALL_FULFILLED';
  payload: {
    callMode: CallMode;
    conversationId: string;
    peekInfo: GroupCallPeekInfoType;
  };
}>;

export type PendingUserActionPayloadType = ReadonlyDeep<{
  serviceId: ServiceIdString | undefined;
}>;

export type BatchUserActionPayloadType = ReadonlyDeep<{
  action: 'approve' | 'deny';
  serviceIds: Array<ServiceIdString>;
}>;

// eslint-disable-next-line local-rules/type-alias-readonlydeep
type RefreshIODevicesActionType = {
  type: 'calling/REFRESH_IO_DEVICES';
  payload: MediaDeviceSettings;
};

type RemoteSharingScreenChangeActionType = ReadonlyDeep<{
  type: 'calling/REMOTE_SHARING_SCREEN_CHANGE';
  payload: RemoteSharingScreenChangeType;
}>;

type RemoteVideoChangeActionType = ReadonlyDeep<{
  type: 'calling/REMOTE_VIDEO_CHANGE';
  payload: RemoteVideoChangeType;
}>;

type RemoveClientActionType = ReadonlyDeep<{
  type: 'calling/REMOVE_CLIENT';
}>;

type BlockClientActionType = ReadonlyDeep<{
  type: 'calling/BLOCK_CLIENT';
}>;

type ReturnToActiveCallActionType = ReadonlyDeep<{
  type: 'calling/RETURN_TO_ACTIVE_CALL';
}>;

type SelectPresentingSourceActionType = ReadonlyDeep<{
  type: 'calling/SELECT_PRESENTING_SOURCE';
  payload: string;
}>;

type SetLocalAudioActionType = ReadonlyDeep<{
  type: 'calling/SET_LOCAL_AUDIO_FULFILLED';
  payload: SetLocalAudioType;
}>;

type SetLocalVideoFulfilledActionType = ReadonlyDeep<{
  type: 'calling/SET_LOCAL_VIDEO_FULFILLED';
  payload: SetLocalVideoType;
}>;

type SetPresentingFulfilledActionType = ReadonlyDeep<{
  type: 'calling/SET_PRESENTING';
  payload?: PresentedSource;
}>;

type SetPresentingSourcesActionType = ReadonlyDeep<{
  type: 'calling/SET_PRESENTING_SOURCES';
  payload: {
    presentableSources: ReadonlyArray<PresentableSource>;
  };
}>;

type SetCapturerBatonActionType = ReadonlyDeep<{
  type: 'calling/SET_CAPTURER_BATON';
  payload: DesktopCapturerBaton;
}>;

type SetOutgoingRingActionType = ReadonlyDeep<{
  type: 'calling/SET_OUTGOING_RING';
  payload: boolean;
}>;

type StartDirectCallActionType = ReadonlyDeep<{
  type: 'calling/START_DIRECT_CALL';
  payload: StartDirectCallType;
}>;
type SuggestLowerHandActionType = ReadonlyDeep<{
  type: 'calling/SUGGEST_LOWER_HAND';
  payload: { suggestLowerHand: boolean };
}>;

type ToggleNeedsScreenRecordingPermissionsActionType = ReadonlyDeep<{
  type: 'calling/TOGGLE_NEEDS_SCREEN_RECORDING_PERMISSIONS';
}>;

type ToggleParticipantsActionType = ReadonlyDeep<{
  type: 'calling/TOGGLE_PARTICIPANTS';
}>;

type TogglePipActionType = ReadonlyDeep<{
  type: 'calling/TOGGLE_PIP';
}>;

type ToggleSettingsActionType = ReadonlyDeep<{
  type: 'calling/TOGGLE_SETTINGS';
}>;

type ChangeCallViewActionType = ReadonlyDeep<{
  type: 'calling/CHANGE_CALL_VIEW';
  viewMode: CallViewMode;
}>;

type SwitchToPresentationViewActionType = ReadonlyDeep<{
  type: 'calling/SWITCH_TO_PRESENTATION_VIEW';
}>;

type SwitchFromPresentationViewActionType = ReadonlyDeep<{
  type: 'calling/SWITCH_FROM_PRESENTATION_VIEW';
}>;

// eslint-disable-next-line local-rules/type-alias-readonlydeep
export type CallingActionType =
  | ApproveUserActionType
  | AcceptCallPendingActionType
  | CallLobbyFailedActionType
  | CancelCallActionType
  | CancelIncomingGroupCallRingActionType
  | ChangeCallViewActionType
  | DenyUserActionType
  | StartCallingLobbyActionType
  | StartCallLinkLobbyActionType
  | CallStateChangeFulfilledActionType
  | ChangeIODeviceFulfilledActionType
  | CloseNeedPermissionScreenActionType
  | ConversationsUpdatedActionType
  | ConversationRemovedActionType
  | DeclineCallActionType
  | GroupCallAudioLevelsChangeActionType
  | GroupCallEndedActionType
  | GroupCallRaisedHandsChangeActionType
  | GroupCallStateChangeActionType
  | GroupCallReactionsReceivedActionType
  | GroupCallReactionsExpiredActionType
  | HandleCallLinkUpdateActionType
  | HandleCallLinkDeleteActionType
  | HangUpActionType
  | IncomingDirectCallActionType
  | IncomingGroupCallActionType
  | OutgoingCallActionType
  | PeekGroupCallFulfilledActionType
  | RefreshIODevicesActionType
  | RemoteSharingScreenChangeActionType
  | RemoteVideoChangeActionType
  | RemoveClientActionType
  | ReturnToActiveCallActionType
  | SendGroupCallReactionActionType
  | SelectPresentingSourceActionType
  | SetCapturerBatonActionType
  | SetLocalAudioActionType
  | SetLocalVideoFulfilledActionType
  | SetPresentingSourcesActionType
  | SetOutgoingRingActionType
  | StartDirectCallActionType
  | ToggleNeedsScreenRecordingPermissionsActionType
  | ToggleParticipantsActionType
  | TogglePipActionType
  | SetPresentingFulfilledActionType
  | ToggleSettingsActionType
  | SuggestLowerHandActionType
  | SwitchToPresentationViewActionType
  | SwitchFromPresentationViewActionType
  | WaitingForCallingLobbyActionType
  | WaitingForCallLinkLobbyActionType;

// Action Creators

function acceptCall(
  payload: AcceptCallType
): ThunkAction<void, RootStateType, unknown, AcceptCallPendingActionType> {
  return async (dispatch, getState) => {
    const { conversationId, asVideoCall } = payload;

    const callingState = getState().calling;
    const call = getOwn(callingState.callsByConversation, conversationId);
    if (!call) {
      log.error('Trying to accept a non-existent call');
      return;
    }

    saveDraftRecordingIfNeeded()(dispatch, getState, undefined);

    switch (call.callMode) {
      case CallMode.Direct:
        await calling.acceptDirectCall(conversationId, asVideoCall);
        break;
      case CallMode.Group:
        await calling.joinGroupCall(conversationId, true, asVideoCall, false);
        break;
      case CallMode.Adhoc:
        log.error('Failed to accept adhoc call, this should never happen.');
        break;
      default:
        throw missingCaseError(call);
    }

    dispatch({
      type: ACCEPT_CALL_PENDING,
      payload,
    });
  };
}

function approveUser(
  payload: PendingUserActionPayloadType
): ThunkAction<void, RootStateType, unknown, ApproveUserActionType> {
  return (dispatch, getState) => {
    const activeCall = getActiveCall(getState().calling);
    if (!activeCall || !isGroupOrAdhocCallMode(activeCall.callMode)) {
      log.warn(
        'approveUser: Trying to approve pending user without active group or adhoc call'
      );
      return;
    }
    if (!isAciString(payload.serviceId)) {
      log.warn(
        'approveUser: Trying to approve pending user without valid aci serviceid'
      );
      return;
    }

    calling.approveUser(activeCall.conversationId, payload.serviceId);
    dispatch({ type: APPROVE_USER });
  };
}

function denyUser(
  payload: PendingUserActionPayloadType
): ThunkAction<void, RootStateType, unknown, DenyUserActionType> {
  return (dispatch, getState) => {
    const activeCall = getActiveCall(getState().calling);
    if (!activeCall || !isGroupOrAdhocCallMode(activeCall.callMode)) {
      log.warn(
        'approveUser: Trying to approve pending user without active group or adhoc call'
      );
      return;
    }
    if (!isAciString(payload.serviceId)) {
      log.warn(
        'approveUser: Trying to approve pending user without valid aci serviceid'
      );
      return;
    }

    calling.denyUser(activeCall.conversationId, payload.serviceId);
    dispatch({ type: DENY_USER });
  };
}

function batchUserAction(
  payload: BatchUserActionPayloadType
): ThunkAction<void, RootStateType, unknown, ShowToastActionType> {
  return (dispatch, getState) => {
    const activeCall = getActiveCall(getState().calling);
    if (!activeCall || !isGroupOrAdhocCallMode(activeCall.callMode)) {
      log.warn(
        'batchUserAction: Trying to do pending user without active group or adhoc call'
      );
      return;
    }

    const { action, serviceIds } = payload;
    let actionFn;
    if (action === 'approve') {
      actionFn = calling.approveUser;
    } else if (action === 'deny') {
      actionFn = calling.denyUser;
    } else {
      throw missingCaseError(action);
    }

    let count = 0;
    for (const serviceId of serviceIds) {
      if (!isAciString(serviceId)) {
        log.warn(
          'batchUserAction: Trying to do user action without valid aci serviceid'
        );
        continue;
      }

      actionFn.call(calling, activeCall.conversationId, serviceId);
      count += 1;
    }

    if (count > 0 && action === 'approve') {
      dispatch({
        type: SHOW_TOAST,
        payload: {
          toastType: ToastType.AddedUsersToCall,
          parameters: { count },
        },
      });
    }
  };
}

function removeClient(
  payload: RemoveClientType
): ThunkAction<void, RootStateType, unknown, RemoveClientActionType> {
  return (dispatch, getState) => {
    const activeCall = getActiveCall(getState().calling);
    if (!activeCall || !isGroupOrAdhocCallMode(activeCall.callMode)) {
      log.warn(
        'removeClient: Trying to remove client without active group or adhoc call'
      );
      return;
    }

    calling.removeClient(activeCall.conversationId, payload.demuxId);
    dispatch({ type: REMOVE_CLIENT });
  };
}

function blockClient(
  payload: RemoveClientType
): ThunkAction<void, RootStateType, unknown, BlockClientActionType> {
  return (dispatch, getState) => {
    const activeCall = getActiveCall(getState().calling);
    if (!activeCall || !isGroupOrAdhocCallMode(activeCall.callMode)) {
      log.warn(
        'blockClient: Trying to block client without active group or adhoc call'
      );
      return;
    }

    calling.blockClient(activeCall.conversationId, payload.demuxId);
    dispatch({ type: BLOCK_CLIENT });
  };
}

function callStateChange(
  payload: CallStateChangeType
): ThunkAction<
  void,
  RootStateType,
  unknown,
  CallStateChangeFulfilledActionType
> {
  return async dispatch => {
    const { callState, acceptedTime, callEndedReason } = payload;

    const wasAccepted = acceptedTime != null;
    const isEnded = callState === CallState.Ended && callEndedReason != null;

    const isLocalHangup = callEndedReason === CallEndedReason.LocalHangup;
    const isRemoteHangup = callEndedReason === CallEndedReason.RemoteHangup;

    // Play the hangup noise if:
    if (
      // 1. I hungup (or declined)
      (isEnded && isLocalHangup) ||
      // 2. I answered and then the call ended
      (isEnded && wasAccepted) ||
      // 3. I called and they declined
      (isEnded && !wasAccepted && isRemoteHangup)
    ) {
      await callingTones.playEndCall();
    }

    dispatch({
      type: CALL_STATE_CHANGE_FULFILLED,
      payload,
    });
  };
}

function changeIODevice(
  payload: ChangeIODevicePayloadType
): ThunkAction<
  void,
  RootStateType,
  unknown,
  ChangeIODeviceFulfilledActionType
> {
  return async dispatch => {
    // Only `setPreferredCamera` returns a Promise.
    if (payload.type === CallingDeviceType.CAMERA) {
      await calling.setPreferredCamera(payload.selectedDevice);
    } else if (payload.type === CallingDeviceType.MICROPHONE) {
      calling.setPreferredMicrophone(payload.selectedDevice);
    } else if (payload.type === CallingDeviceType.SPEAKER) {
      calling.setPreferredSpeaker(payload.selectedDevice);
    }
    dispatch({
      type: CHANGE_IO_DEVICE_FULFILLED,
      payload,
    });
  };
}

function closeNeedPermissionScreen(): CloseNeedPermissionScreenActionType {
  return {
    type: CLOSE_NEED_PERMISSION_SCREEN,
    payload: null,
  };
}

function cancelCall(payload: CancelCallType): CancelCallActionType {
  calling.stopCallingLobby(payload.conversationId);

  return {
    type: CANCEL_CALL,
  };
}

function cancelIncomingGroupCallRing(
  payload: CancelIncomingGroupCallRingType
): CancelIncomingGroupCallRingActionType {
  return {
    type: CANCEL_INCOMING_GROUP_CALL_RING,
    payload,
  };
}

function declineCall(
  payload: DeclineCallType
): ThunkAction<
  void,
  RootStateType,
  unknown,
  CancelIncomingGroupCallRingActionType | DeclineCallActionType
> {
  return (dispatch, getState) => {
    const { conversationId } = payload;

    const call = getOwn(getState().calling.callsByConversation, conversationId);
    if (!call) {
      log.error('Trying to decline a non-existent call');
      return;
    }

    switch (call.callMode) {
      case CallMode.Direct:
        calling.declineDirectCall(conversationId);
        dispatch({
          type: DECLINE_DIRECT_CALL,
          payload,
        });
        break;
      case CallMode.Group: {
        const { ringId } = call;
        if (ringId === undefined) {
          log.error('Trying to decline a group call without a ring ID');
        } else {
          calling.declineGroupCall(conversationId, ringId);
          dispatch({
            type: CANCEL_INCOMING_GROUP_CALL_RING,
            payload: { conversationId, ringId },
          });
        }
        break;
      }
      case CallMode.Adhoc:
        log.error(
          'Cannot decline an adhoc call because adhoc calls should never be incoming.'
        );
        break;
      default:
        throw missingCaseError(call);
    }
  };
}

const globalCapturers = new WeakMap<DesktopCapturerBaton, DesktopCapturer>();

function getPresentingSources(): ThunkAction<
  void,
  RootStateType,
  unknown,
  | SetCapturerBatonActionType
  | SetPresentingSourcesActionType
  | ToggleNeedsScreenRecordingPermissionsActionType
> {
  return async (dispatch, getState) => {
    const i18n = getIntl(getState());

    // We check if the user has permissions first before calling desktopCapturer
    // Next we call getPresentingSources so that one gets the prompt for permissions,
    // if necessary.
    // Finally, we have the if statement which shows the modal, if needed.
    // It is in this exact order so that during first-time-use one will be
    // prompted for permissions and if they so happen to deny we can still
    // capture that state correctly.
    const platform = getPlatform(getState());
    const needsPermission =
      platform === 'darwin' &&
      !isNativeMacScreenShareSupported &&
      !hasScreenCapturePermission();

    const capturer = new DesktopCapturer({
      i18n,
      onPresentableSources(presentableSources) {
        if (needsPermission) {
          // Abort
          capturer.abort();
          return;
        }

        dispatch({
          type: SET_PRESENTING_SOURCES,
          payload: {
            presentableSources,
          },
        });
      },
      onMediaStream(mediaStream) {
        dispatch(
          _setPresenting(
            getPresentingSource(getState()) || {
              id: 'media-stream',
              name: '',
            },
            mediaStream
          )
        );
      },
      onError(error) {
        log.error('getPresentingSources: got error', Errors.toLogFormat(error));
      },
    });
    globalCapturers.set(capturer.baton, capturer);

    dispatch({
      type: SET_CAPTURER_BATON,
      payload: capturer.baton,
    });

    if (needsPermission) {
      dispatch({
        type: TOGGLE_NEEDS_SCREEN_RECORDING_PERMISSIONS,
      });
    }
  };
}

function groupCallAudioLevelsChange(
  payload: GroupCallAudioLevelsChangeActionPayloadType
): GroupCallAudioLevelsChangeActionType {
  return { type: GROUP_CALL_AUDIO_LEVELS_CHANGE, payload };
}

function groupCallEnded(
  payload: GroupCallEndedActionPayloadType
): ThunkAction<
  void,
  RootStateType,
  unknown,
  GroupCallEndedActionType | ShowErrorModalActionType
> {
  return (dispatch, getState) => {
    const { endedReason } = payload;
    if (endedReason === GroupCallEndReason.DeniedRequestToJoinCall) {
      const i18n = getIntl(getState());
      dispatch({
        type: SHOW_ERROR_MODAL,
        payload: {
          title: i18n('icu:calling__join-request-denied-title'),
          description: i18n('icu:calling__join-request-denied'),
          buttonVariant: ButtonVariant.Primary,
        },
      });
      return;
    }
    if (endedReason === GroupCallEndReason.RemovedFromCall) {
      const i18n = getIntl(getState());
      dispatch({
        type: SHOW_ERROR_MODAL,
        payload: {
          title: i18n('icu:calling__removed-from-call-title'),
          description: i18n('icu:calling__removed-from-call'),
          buttonVariant: ButtonVariant.Primary,
        },
      });
      return;
    }

    dispatch({ type: GROUP_CALL_ENDED, payload });
  };
}

function receiveGroupCallReactions(
  payload: GroupCallReactionsReceivedArgumentType
): ThunkAction<
  void,
  RootStateType,
  unknown,
  GroupCallReactionsReceivedActionType | GroupCallReactionsExpiredActionType
> {
  return async dispatch => {
    const { callMode, conversationId } = payload;
    const timestamp = Date.now();

    dispatch({
      type: GROUP_CALL_REACTIONS_RECEIVED,
      payload: { ...payload, callMode, timestamp },
    });
    await sleep(CALLING_REACTIONS_LIFETIME);

    dispatch({
      type: GROUP_CALL_REACTIONS_EXPIRED,
      payload: { conversationId, timestamp },
    });
  };
}

function groupCallRaisedHandsChange(
  payload: GroupCallRaisedHandsChangeActionPayloadType
): ThunkAction<
  void,
  RootStateType,
  unknown,
  GroupCallRaisedHandsChangeActionType
> {
  return async (dispatch, getState) => {
    const { callMode, conversationId, raisedHands } = payload;

    const existingCall = getGroupCall(
      conversationId,
      getState().calling,
      callMode
    );
    const isFirstHandRaised =
      existingCall &&
      !existingCall.raisedHands?.length &&
      raisedHands.length > 0;
    if (isFirstHandRaised) {
      drop(callingTones.handRaised());
    }

    dispatch({ type: GROUP_CALL_RAISED_HANDS_CHANGE, payload });
  };
}

function groupCallStateChange(
  payload: GroupCallStateChangeArgumentType
): ThunkAction<void, RootStateType, unknown, GroupCallStateChangeActionType> {
  return async (dispatch, getState) => {
    let didSomeoneStartPresenting: boolean;
    const activeCall = getActiveCall(getState().calling);
    if (isGroupOrAdhocCallState(activeCall)) {
      const wasSomeonePresenting = activeCall.remoteParticipants.some(
        participant => participant.presenting
      );
      const isSomeonePresenting = payload.remoteParticipants.some(
        participant => participant.presenting
      );
      didSomeoneStartPresenting = !wasSomeonePresenting && isSomeonePresenting;
    } else {
      didSomeoneStartPresenting = false;
    }

    const { ourAci } = getState().user;
    strictAssert(ourAci, 'groupCallStateChange failed to fetch our ACI');

    dispatch({
      type: GROUP_CALL_STATE_CHANGE,
      payload: {
        ...payload,
        ourAci,
      },
    });

    if (didSomeoneStartPresenting) {
      void callingTones.someonePresenting();
    }
  };
}

// From sync messages, to notify us that another device joined or changed a call link.
function handleCallLinkUpdate(
  payload: HandleCallLinkUpdateType
): ThunkAction<
  void,
  RootStateType,
  unknown,
  HandleCallLinkUpdateActionType | CallHistoryAdd
> {
  return async dispatch => {
    const { rootKey, adminKey } = payload;
    const callLinkRootKey = CallLinkRootKey.parse(rootKey);
    const roomId = getRoomIdFromRootKey(callLinkRootKey);
    const logId = `handleCallLinkUpdate(${roomId})`;

    const existingCallLink = await DataReader.getCallLinkByRoomId(roomId);

    const callLink: CallLinkType = {
      ...CALL_LINK_DEFAULT_STATE,
      storageNeedsSync: false,
      ...existingCallLink,
      roomId,
      rootKey,
      adminKey,
    };

    let callHistory: CallHistoryDetails | null = null;

    if (existingCallLink) {
      if (adminKey && adminKey !== existingCallLink.adminKey) {
        log.info(`${logId}: Updating existing call link with new adminKey`);
        await DataWriter.updateCallLinkAdminKeyByRoomId(roomId, adminKey);
      }
    } else {
      log.info(`${logId}: Saving new call link`);
      await DataWriter.insertCallLink(callLink);
      if (adminKey != null) {
        callHistory = toCallHistoryFromUnusedCallLink(callLink);
        await DataWriter.saveCallHistory(callHistory);
      }
    }

    dispatch({
      type: HANDLE_CALL_LINK_UPDATE,
      payload: { callLink },
    });

    if (callHistory != null) {
      dispatch(addCallHistory(callHistory));
    }

    // Schedule async refresh. It's possible to get a big batch of sync messages.
    // This job will throttle requests to the calling server.
    drop(
      callLinkRefreshJobQueue.add({
        rootKey,
        source: 'handleCallLinkUpdate',
      })
    );
  };
}

function handleCallLinkUpdateLocal(
  callLink: CallLinkType
): ThunkAction<void, RootStateType, unknown, HandleCallLinkUpdateActionType> {
  return dispatch => {
    dispatch({
      type: HANDLE_CALL_LINK_UPDATE,
      payload: { callLink },
    });
  };
}

function handleCallLinkDelete(
  payload: HandleCallLinkDeleteType
): ThunkAction<void, RootStateType, unknown, HandleCallLinkDeleteActionType> {
  return async dispatch => {
    dispatch({
      type: HANDLE_CALL_LINK_DELETE,
      payload,
    });

    dispatch(reloadCallHistory());
  };
}

function hangUpActiveCall(
  reason: string
): ThunkAction<void, RootStateType, unknown, HangUpActionType> {
  return async (dispatch, getState) => {
    const state = getState();

    const activeCall = getActiveCall(state.calling);
    if (!activeCall) {
      return;
    }

    const { conversationId } = activeCall;

    calling.hangup(conversationId, reason);

    dispatch({
      type: HANG_UP,
      payload: {
        conversationId,
      },
    });

    if (isGroupOrAdhocCallState(activeCall)) {
      // We want to give the group call time to disconnect.
      await sleep(1000);
      doGroupCallPeek({
        conversationId,
        callMode: activeCall.callMode,
        dispatch,
        getState,
      });
    }
  };
}

function setSuggestLowerHand(
  suggestLowerHand: boolean
): SuggestLowerHandActionType {
  return {
    type: SUGGEST_LOWER_HAND,
    payload: { suggestLowerHand },
  };
}

function sendGroupCallRaiseHand(
  payload: SendGroupCallRaiseHandType
): ThunkAction<void, RootStateType, unknown, SendGroupCallRaiseHandActionType> {
  return dispatch => {
    calling.sendGroupCallRaiseHand(payload.conversationId, payload.raise);

    dispatch({
      type: RAISE_HAND_GROUP_CALL,
      payload,
    });
  };
}

function sendGroupCallReaction(
  payload: SendGroupCallReactionType
): ThunkAction<
  void,
  RootStateType,
  unknown,
  SendGroupCallReactionActionType | GroupCallReactionsExpiredActionType
> {
  return async dispatch => {
    const { callMode, conversationId } = payload;
    const timestamp = Date.now();

    calling.sendGroupCallReaction(payload.conversationId, payload.value);
    dispatch({
      type: SEND_GROUP_CALL_REACTION,
      payload: { ...payload, callMode, timestamp },
    });
    await sleep(CALLING_REACTIONS_LIFETIME);

    dispatch({
      type: GROUP_CALL_REACTIONS_EXPIRED,
      payload: { conversationId, timestamp },
    });
  };
}

function receiveIncomingDirectCall(
  payload: IncomingDirectCallType
): ThunkAction<void, RootStateType, unknown, IncomingDirectCallActionType> {
  return (dispatch, getState) => {
    const callState = getState().calling;

    if (
      callState.activeCallState &&
      callState.activeCallState.conversationId === payload.conversationId
    ) {
      calling.stopCallingLobby();
    }

    dispatch({
      type: INCOMING_DIRECT_CALL,
      payload,
    });
  };
}

function receiveIncomingGroupCall(
  payload: IncomingGroupCallType
): IncomingGroupCallActionType {
  return {
    type: INCOMING_GROUP_CALL,
    payload,
  };
}

function openSystemPreferencesAction(): ThunkAction<
  void,
  RootStateType,
  unknown,
  never
> {
  return () => {
    void openSystemPreferences();
  };
}

function outgoingCall(payload: StartDirectCallType): OutgoingCallActionType {
  return {
    type: OUTGOING_CALL,
    payload,
  };
}

function joinedAdhocCall(
  roomId: string
): ThunkAction<void, RootStateType, unknown, never> {
  return async (_dispatch, getState) => {
    const state = getState();
    const callLink = getOwn(state.calling.callLinks, roomId);
    if (!callLink) {
      log.warn(`joinedAdhocCall(${roomId}): call link not found`);
      return;
    }

    drop(sendCallLinkUpdateSync(callLink));
  };
}

function peekGroupCallForTheFirstTime(
  conversationId: string
): ThunkAction<void, RootStateType, unknown, PeekGroupCallFulfilledActionType> {
  return (dispatch, getState) => {
    const call = getOwn(getState().calling.callsByConversation, conversationId);
    const shouldPeek =
      !call || (isGroupOrAdhocCallState(call) && !call.peekInfo);
    const callMode = call?.callMode ?? CallMode.Group;
    if (callMode === CallMode.Direct) {
      return;
    }

    if (shouldPeek) {
      doGroupCallPeek({
        conversationId,
        callMode,
        dispatch,
        getState,
      });
    }
  };
}

function peekGroupCallIfItHasMembers(
  conversationId: string
): ThunkAction<void, RootStateType, unknown, PeekGroupCallFulfilledActionType> {
  return (dispatch, getState) => {
    const call = getOwn(getState().calling.callsByConversation, conversationId);
    const shouldPeek =
      call &&
      isGroupOrAdhocCallState(call) &&
      call.joinState === GroupCallJoinState.NotJoined &&
      call.peekInfo &&
      call.peekInfo.deviceCount > 0;
    if (shouldPeek) {
      doGroupCallPeek({
        conversationId,
        callMode: call.callMode,
        dispatch,
        getState,
      });
    }
  };
}

function peekNotConnectedGroupCall(
  payload: PeekNotConnectedGroupCallType
): ThunkAction<void, RootStateType, unknown, PeekGroupCallFulfilledActionType> {
  return (dispatch, getState) => {
    const { callMode, conversationId } = payload;
    doGroupCallPeek({
      conversationId,
      callMode,
      dispatch,
      getState,
    });
  };
}

function refreshIODevices(
  payload: MediaDeviceSettings
): RefreshIODevicesActionType {
  return {
    type: REFRESH_IO_DEVICES,
    payload,
  };
}

function remoteSharingScreenChange(
  payload: RemoteSharingScreenChangeType
): RemoteSharingScreenChangeActionType {
  return {
    type: REMOTE_SHARING_SCREEN_CHANGE,
    payload,
  };
}

function remoteVideoChange(
  payload: RemoteVideoChangeType
): RemoteVideoChangeActionType {
  return {
    type: REMOTE_VIDEO_CHANGE,
    payload,
  };
}

function returnToActiveCall(): ReturnToActiveCallActionType {
  return {
    type: RETURN_TO_ACTIVE_CALL,
  };
}

function selectPresentingSource(id: string): SelectPresentingSourceActionType {
  return {
    type: SELECT_PRESENTING_SOURCE,
    payload: id,
  };
}

function setIsCallActive(
  isCallActive: boolean
): ThunkAction<void, RootStateType, unknown, never> {
  return () => {
    window.SignalContext.setIsCallActive(isCallActive);
  };
}

function setRendererCanvas(
  payload: SetRendererCanvasType
): ThunkAction<void, RootStateType, unknown, never> {
  return () => {
    calling.videoRenderer.setCanvas(payload.element);
  };
}

function setLocalAudio(
  payload: SetLocalAudioType
): ThunkAction<void, RootStateType, unknown, SetLocalAudioActionType> {
  return (dispatch, getState) => {
    const activeCall = getActiveCall(getState().calling);
    if (!activeCall) {
      log.warn('Trying to set local audio when no call is active');
      return;
    }

    calling.setOutgoingAudio(activeCall.conversationId, payload.enabled);

    dispatch({
      type: SET_LOCAL_AUDIO_FULFILLED,
      payload,
    });
  };
}

function setLocalVideo(
  payload: SetLocalVideoType
): ThunkAction<void, RootStateType, unknown, SetLocalVideoFulfilledActionType> {
  return async (dispatch, getState) => {
    const activeCall = getActiveCall(getState().calling);
    if (!activeCall) {
      log.warn('Trying to set local video when no call is active');
      return;
    }

    let enabled: boolean;
    if (await requestCameraPermissions()) {
      if (
        isGroupOrAdhocCallState(activeCall) ||
        (activeCall.callMode === CallMode.Direct && activeCall.callState)
      ) {
        calling.setOutgoingVideo(activeCall.conversationId, payload.enabled);
      } else if (payload.enabled) {
        calling.enableLocalCamera();
      } else {
        calling.disableLocalVideo();
      }
      ({ enabled } = payload);
    } else {
      enabled = false;
    }

    dispatch({
      type: SET_LOCAL_VIDEO_FULFILLED,
      payload: {
        ...payload,
        enabled,
      },
    });
  };
}

function setGroupCallVideoRequest(
  payload: SetGroupCallVideoRequestType
): ThunkAction<void, RootStateType, unknown, never> {
  return () => {
    calling.setGroupCallVideoRequest(
      payload.conversationId,
      payload.resolutions.map(resolution => ({
        ...resolution,
        // The `framerate` property in RingRTC has to be set, even if it's set to
        //   `undefined`.
        framerate: undefined,
      })),
      payload.speakerHeight
    );
  };
}

function _setPresenting(
  sourceToPresent?: PresentedSource,
  mediaStream?: MediaStream
): ThunkAction<void, RootStateType, unknown, SetPresentingFulfilledActionType> {
  return async (dispatch, getState) => {
    const state = getState();
    const callingState = state.calling;

    const { activeCallState } = callingState;
    const activeCall = getActiveCall(callingState);
    if (
      !activeCall ||
      !activeCallState ||
      activeCallState.state === 'Waiting'
    ) {
      log.warn('Trying to present when no call is active');
      return;
    }

    let rootKey: string | undefined;
    if (activeCall.callMode === CallMode.Adhoc) {
      const callLink = getOwn(
        getCallLinksByRoomId(state),
        activeCall.conversationId
      );
      rootKey = callLink?.rootKey;
    }

    await calling.setPresenting({
      conversationId: activeCall.conversationId,
      hasLocalVideo: activeCallState.hasLocalVideo,
      mediaStream,
      source: sourceToPresent,
      callLinkRootKey: rootKey,
    });

    dispatch({
      type: SET_PRESENTING,
      payload: sourceToPresent,
    });

    if (mediaStream) {
      await callingTones.someonePresenting();
    }
  };
}

function cancelPresenting(): ThunkAction<
  void,
  RootStateType,
  unknown,
  SetPresentingFulfilledActionType
> {
  return _setPresenting(undefined, undefined);
}

function setOutgoingRing(payload: boolean): SetOutgoingRingActionType {
  return {
    type: SET_OUTGOING_RING,
    payload,
  };
}

function onOutgoingVideoCallInConversation(
  conversationId: string
): ThunkAction<
  void,
  RootStateType,
  unknown,
  StartCallingLobbyActionType | ShowToastActionType
> {
  return async (dispatch, getState) => {
    const conversation = window.ConversationController.get(conversationId);
    if (!conversation) {
      throw new Error(
        `onOutgoingVideoCallInConversation: No conversation found for conversation ${conversationId}`
      );
    }

    log.info('onOutgoingVideoCallInConversation: about to start a video call');

    const call = getOwn(getState().calling.callsByConversation, conversationId);

    // Technically not necessary, but isAnybodyElseInGroupCall requires it
    const ourAci = window.storage.user.getCheckedAci();
    const isOngoingGroupCall =
      call &&
      ourAci &&
      isGroupOrAdhocCallState(call) &&
      call.peekInfo &&
      isAnybodyElseInGroupCall(call.peekInfo, ourAci);

    // If it's a group call on an announcementsOnly group, only allow join if the call
    //   has already been started (presumably by the admin)
    if (conversation.get('announcementsOnly') && !conversation.areWeAdmin()) {
      if (!isOngoingGroupCall) {
        dispatch({
          type: SHOW_TOAST,
          payload: {
            toastType: ToastType.CannotStartGroupCall,
          },
        });
        return;
      }
    }

    const source = isOngoingGroupCall
      ? SafetyNumberChangeSource.JoinCall
      : SafetyNumberChangeSource.InitiateCall;

    if (await isCallSafe(conversation.attributes, source)) {
      log.info(
        'onOutgoingVideoCallInConversation: call is deemed "safe". Starting lobby'
      );
      dispatch(
        startCallingLobby({
          conversationId,
          isVideoCall: true,
        })
      );
    } else {
      log.info(
        'onOutgoingVideoCallInConversation: call is deemed "unsafe". Stopping'
      );
    }
  };
}

function onOutgoingAudioCallInConversation(
  conversationId: string
): ThunkAction<void, RootStateType, unknown, StartCallingLobbyActionType> {
  return async (dispatch, getState) => {
    const conversation = window.ConversationController.get(conversationId);
    if (!conversation) {
      throw new Error(
        `onOutgoingAudioCallInConversation: No conversation found for conversation ${conversationId}`
      );
    }

    if (!isDirectConversation(conversation.attributes)) {
      throw new Error(
        `onOutgoingAudioCallInConversation: Conversation ${conversation.idForLogging()} is not 1:1`
      );
    }
    // Because audio calls are currently restricted to 1:1 conversations, this will always
    //   be a new call we are initiating.
    const source = SafetyNumberChangeSource.InitiateCall;

    log.info('onOutgoingAudioCallInConversation: about to start an audio call');

    if (await isCallSafe(conversation.attributes, source)) {
      log.info(
        'onOutgoingAudioCallInConversation: call is deemed "safe". Starting lobby'
      );
      startCallingLobby({
        conversationId,
        isVideoCall: false,
      })(dispatch, getState, undefined);
    } else {
      log.info(
        'onOutgoingAudioCallInConversation: call is deemed "unsafe". Stopping'
      );
    }
  };
}

function createCallLink(
  onCreated: (roomId: string) => void
): ThunkAction<
  void,
  RootStateType,
  unknown,
  CallHistoryAdd | HandleCallLinkUpdateActionType
> {
  return async dispatch => {
    const callLink = await calling.createCallLink();
    const callHistory = toCallHistoryFromUnusedCallLink(callLink);
    await Promise.all([
      DataWriter.insertCallLink(callLink),
      DataWriter.saveCallHistory(callHistory),
    ]);

    storageServiceUploadJob({ reason: 'createCallLink' });

    dispatch({
      type: HANDLE_CALL_LINK_UPDATE,
      payload: { callLink },
    });
    dispatch(addCallHistory(callHistory));
    // Call after dispatching the action to ensure the call link is in the store
    onCreated(callLink.roomId);
  };
}

function deleteCallLink(
  roomId: string
): ThunkAction<
  void,
  RootStateType,
  unknown,
  HandleCallLinkDeleteActionType | ShowErrorModalActionType
> {
  return async (dispatch, getState) => {
    const callLink = await DataReader.getCallLinkByRoomId(roomId);
    if (!callLink) {
      return;
    }

    const isStorageSyncNeeded = await DataWriter.beginDeleteCallLink(roomId);
    if (isStorageSyncNeeded) {
      storageServiceUploadJob({ reason: 'deleteCallLink' });
    }
    try {
      if (isCallLinkAdmin(callLink)) {
        // This throws if call link is active or network is unavailable.
        await calling.deleteCallLink(callLink);
        // Wait for storage service sync before finalizing delete.
        drop(
          CallLinkFinalizeDeleteManager.addJob(
            { roomId: callLink.roomId },
            { delay: 10000 }
          )
        );
      }

      await DataWriter.deleteCallHistoryByRoomId(callLink.roomId);
      dispatch(handleCallLinkDelete({ roomId }));
    } catch (error) {
      log.warn('clearCallHistory: Failed to delete call link', error);

      const i18n = getIntl(getState());
      dispatch({
        type: SHOW_ERROR_MODAL,
        payload: {
          title: null,
          description: i18n('icu:calling__call-link-delete-failed'),
          buttonVariant: ButtonVariant.Primary,
        },
      });
    }
  };
}

function updateCallLinkName(
  roomId: string,
  name: string
): ThunkAction<void, RootStateType, unknown, HandleCallLinkUpdateActionType> {
  return async dispatch => {
    const prevCallLink = await DataReader.getCallLinkByRoomId(roomId);
    strictAssert(
      prevCallLink,
      `updateCallLinkName(${roomId}): call link not found`
    );
    const callLinkState = await calling.updateCallLinkName(prevCallLink, name);
    const callLink = await DataWriter.updateCallLinkState(
      roomId,
      callLinkState
    );
    dispatch({
      type: HANDLE_CALL_LINK_UPDATE,
      payload: { callLink },
    });
  };
}

function updateCallLinkRestrictions(
  roomId: string,
  restrictions: CallLinkRestrictions
): ThunkAction<void, RootStateType, unknown, HandleCallLinkUpdateActionType> {
  return async dispatch => {
    const prevCallLink = await DataReader.getCallLinkByRoomId(roomId);
    strictAssert(
      prevCallLink,
      `updateCallLinkRestrictions(${roomId}): call link not found`
    );
    const callLinkState = await calling.updateCallLinkRestrictions(
      prevCallLink,
      restrictions
    );
    const callLink = await DataWriter.updateCallLinkState(
      roomId,
      callLinkState
    );
    dispatch({
      type: HANDLE_CALL_LINK_UPDATE,
      payload: { callLink },
    });
  };
}

function startCallLinkLobbyByRoomId({
  roomId,
}: StartCallLinkLobbyByRoomIdType): StartCallLinkLobbyThunkActionType {
  return async (dispatch, getState) => {
    const state = getState();
    const callLink = getOwn(state.calling.callLinks, roomId);

    strictAssert(
      callLink,
      `startCallLinkLobbyByRoomId(${roomId}): call link not found`
    );

    const { rootKey } = callLink;
    await _startCallLinkLobby({ rootKey, dispatch, getState });
  };
}

function startCallLinkLobby({
  rootKey,
}: StartCallLinkLobbyType): StartCallLinkLobbyThunkActionType {
  return async (dispatch, getState) => {
    await _startCallLinkLobby({ rootKey, dispatch, getState });
  };
}

const _startCallLinkLobby = async ({
  rootKey,
  dispatch,
  getState,
}: {
  rootKey: string;
  dispatch: ThunkDispatch<
    RootStateType,
    unknown,
    | CallLobbyFailedActionType
    | StartCallLinkLobbyActionType
    | ShowErrorModalActionType
    | ToggleConfirmLeaveCallModalActionType
    | TogglePipActionType
    | WaitingForCallLinkLobbyActionType
  >;
  getState: () => RootStateType;
}) => {
  const callLinkRootKey = CallLinkRootKey.parse(rootKey);
  const roomId = getRoomIdFromRootKey(callLinkRootKey);
  const state = getState();

  const logId = `_startCallLinkLobby(${roomId})`;

  const { activeCallState } = state.calling;
  if (activeCallState && activeCallState.conversationId === roomId) {
    if (activeCallState.state === 'Active') {
      dispatch(togglePip());
    } else {
      log.warn(
        `${logId}: Attempted to start lobby while already waiting for it!`
      );
    }
    return;
  }
  if (activeCallState) {
    dispatch(
      toggleConfirmLeaveCallModal({
        type: 'adhoc-rootKey',
        rootKey,
      })
    );
    return;
  }

  let success = false;
  try {
    dispatch({
      type: WAITING_FOR_CALL_LINK_LOBBY,
      payload: {
        roomId,
      },
    });

    let callLinkState: CallLinkStateType | null = null;
    callLinkState = await calling.readCallLink(callLinkRootKey);

    if (callLinkState == null) {
      const i18n = getIntl(getState());
      dispatch({
        type: SHOW_ERROR_MODAL,
        payload: {
          title: i18n('icu:calling__cant-join'),
          description: i18n('icu:calling__call-link-connection-issues'),
          buttonVariant: ButtonVariant.Primary,
        },
      });
      return;
    }

    if (
      callLinkState.revoked ||
      callLinkState.expiration == null ||
      callLinkState.expiration < new Date().getTime()
    ) {
      const i18n = getIntl(getState());
      dispatch({
        type: SHOW_ERROR_MODAL,
        payload: {
          title: i18n('icu:calling__cant-join'),
          description: i18n('icu:calling__call-link-no-longer-valid'),
          buttonVariant: ButtonVariant.Primary,
        },
      });
      return;
    }

    const callLinkExists = await DataReader.callLinkExists(roomId);
    if (callLinkExists) {
      await DataWriter.updateCallLinkState(roomId, callLinkState);
      log.info(`${logId}: Updated existing call link`);
    } else {
      const { name, restrictions, expiration, revoked } = callLinkState;
      await DataWriter.insertCallLink({
        roomId,
        rootKey,
        adminKey: null,
        name,
        restrictions,
        revoked,
        expiration,
        storageNeedsSync: false,
      });
      log.info(`${logId}: Saved new call link`);
    }

    const groupCall = getGroupCall(roomId, state.calling, CallMode.Adhoc);
    const groupCallDeviceCount =
      groupCall?.peekInfo?.deviceCount ||
      groupCall?.remoteParticipants.length ||
      0;

    const { adminKey } = getOwn(state.calling.callLinks, roomId) ?? {};
    const adminPasskey = adminKey ? toAdminKeyBytes(adminKey) : undefined;

    const callLobbyData = await calling.startCallLinkLobby({
      callLinkRootKey,
      adminPasskey,
      hasLocalAudio:
        groupCallDeviceCount < MAX_CALL_PARTICIPANTS_FOR_DEFAULT_MUTE,
    });
    if (!callLobbyData) {
      throw new Error('Failed to start call lobby');
    }

    dispatch({
      type: START_CALL_LINK_LOBBY,
      payload: {
        ...callLobbyData,
        callLinkState,
        callLinkRoomId: roomId,
        callLinkRootKey: rootKey,
        conversationId: roomId,
        isConversationTooBigToRing: false,
      },
    });
    success = true;
  } catch (error) {
    log.error(`${logId}: Failed to start lobby`, Errors.toLogFormat(error));
  } finally {
    if (!success) {
      try {
        calling.stopCallingLobby(roomId);
      } catch (innerError) {
        log.error(
          `${logId}: Failed to stop calling lobby`,
          Errors.toLogFormat(innerError)
        );
      }

      dispatch({
        type: CALL_LOBBY_FAILED,
        payload: { conversationId: roomId },
      });
    }
  }
};

function leaveCurrentCallAndStartCallingLobby(
  data: StartCallData
): ThunkAction<void, RootStateType, unknown, HangUpActionType> {
  return async (dispatch, getState) => {
    hangUpActiveCall(
      'Leave call button pressed in ConfirmLeaveCurrentCallModal'
    )(dispatch, getState, undefined);

    const { type } = data;
    if (type === 'conversation') {
      const { conversationId, isVideoCall } = data;
      startCallingLobby({ conversationId, isVideoCall })(
        dispatch,
        getState,
        undefined
      );
    } else if (type === 'adhoc-roomId') {
      const { roomId } = data;
      startCallLinkLobbyByRoomId({ roomId })(dispatch, getState, undefined);
    } else if (type === 'adhoc-rootKey') {
      const { rootKey } = data;
      startCallLinkLobby({ rootKey })(dispatch, getState, undefined);
    } else {
      throw missingCaseError(type);
    }
  };
}

function startCallingLobby({
  conversationId,
  isVideoCall,
}: StartCallingLobbyType): ThunkAction<
  void,
  RootStateType,
  unknown,
  | CallLobbyFailedActionType
  | StartCallingLobbyActionType
  | ToggleConfirmLeaveCallModalActionType
  | TogglePipActionType
  | WaitingForCallingLobbyActionType
> {
  return async (dispatch, getState) => {
    const state = getState();
    const conversation = getOwn(
      state.conversations.conversationLookup,
      conversationId
    );
    strictAssert(
      conversation,
      "startCallingLobby: can't start lobby without a conversation"
    );

    const logId = `startCallingLobby(${getConversationIdForLogging(conversation)})`;
    const { activeCallState } = state.calling;

    if (activeCallState && activeCallState.conversationId === conversationId) {
      if (activeCallState.state === 'Active') {
        dispatch(togglePip());
      } else {
        log.warn(
          `${logId}: Attempted to start lobby while already waiting for it!`
        );
      }
      return;
    }
    if (activeCallState) {
      dispatch(
        toggleConfirmLeaveCallModal({
          type: 'conversation',
          conversationId,
          isVideoCall,
        })
      );
      return;
    }

    let success = false;
    try {
      dispatch({
        type: WAITING_FOR_CALLING_LOBBY,
        payload: {
          conversationId,
        },
      });

      // The group call device count is considered 0 for a direct call.
      const groupCall = getGroupCall(
        conversationId,
        state.calling,
        CallMode.Group
      );
      const groupCallDeviceCount =
        groupCall?.peekInfo?.deviceCount ||
        groupCall?.remoteParticipants.length ||
        0;
      const callLobbyData = await calling.startCallingLobby({
        conversation,
        hasLocalAudio:
          groupCallDeviceCount < MAX_CALL_PARTICIPANTS_FOR_DEFAULT_MUTE,
        hasLocalVideo: isVideoCall,
      });
      if (!callLobbyData) {
        throw new Error('Failed to start call lobby');
      }

      dispatch({
        type: START_CALLING_LOBBY,
        payload: {
          ...callLobbyData,
          conversationId,
          isConversationTooBigToRing: isConversationTooBigToRing(conversation),
        },
      });
      success = true;
    } catch (error) {
      log.error(`${logId}: Failed to start lobby`, Errors.toLogFormat(error));
    } finally {
      if (!success) {
        try {
          calling.stopCallingLobby(conversationId);
        } catch (innerError) {
          log.error(
            `${logId}: Failed to stop calling lobby`,
            Errors.toLogFormat(innerError)
          );
        }

        dispatch({
          type: CALL_LOBBY_FAILED,
          payload: { conversationId },
        });
      }
    }
  };
}

function startCall(
  payload: StartCallType
): ThunkAction<void, RootStateType, unknown, StartDirectCallActionType> {
  return async (dispatch, getState) => {
    const { callMode, conversationId, hasLocalAudio, hasLocalVideo } = payload;

    const logId = `startCall(${conversationId})`;
    const state = getState();
    const { activeCallState } = state.calling;

    log.info(`${logId}: starting, mode ${callMode}`);

    if (activeCallState?.state === 'Waiting') {
      log.error(`${logId}: Call is not ready; `);
      return;
    }

    switch (callMode) {
      case CallMode.Direct:
        await calling.startOutgoingDirectCall(
          conversationId,
          hasLocalAudio,
          hasLocalVideo
        );
        dispatch({
          type: START_DIRECT_CALL,
          payload,
        });
        break;
      case CallMode.Group: {
        let outgoingRing: boolean;

        if (activeCallState?.outgoingRing) {
          const conversation = getOwn(
            state.conversations.conversationLookup,
            activeCallState.conversationId
          );
          outgoingRing = Boolean(
            conversation && !isConversationTooBigToRing(conversation)
          );
        } else {
          outgoingRing = false;
        }

        await calling.joinGroupCall(
          conversationId,
          hasLocalAudio,
          hasLocalVideo,
          outgoingRing
        );
        // The calling service should already be wired up to Redux so we don't need to
        //   dispatch anything here.
        break;
      }
      case CallMode.Adhoc: {
        const callLink = getOwn(state.calling.callLinks, conversationId);
        if (!callLink) {
          log.error(
            `startCall: Failed to start call link call because roomId ${conversationId} is missing from calling state`
          );
          return;
        }

        await calling.joinCallLinkCall({
          roomId: conversationId,
          rootKey: callLink.rootKey,
          adminKey: callLink.adminKey ?? undefined,
          hasLocalAudio,
          hasLocalVideo,
        });

        // The calling service should already be wired up to Redux so we don't need to
        //   dispatch anything here.
        break;
      }
      default:
        throw missingCaseError(callMode);
    }
  };
}

function toggleParticipants(): ToggleParticipantsActionType {
  return {
    type: TOGGLE_PARTICIPANTS,
  };
}

function togglePip(): TogglePipActionType {
  return {
    type: TOGGLE_PIP,
  };
}

function toggleScreenRecordingPermissionsDialog(): ToggleNeedsScreenRecordingPermissionsActionType {
  return {
    type: TOGGLE_NEEDS_SCREEN_RECORDING_PERMISSIONS,
  };
}

function toggleSettings(): ToggleSettingsActionType {
  return {
    type: TOGGLE_SETTINGS,
  };
}

function changeCallView(mode: CallViewMode): ChangeCallViewActionType {
  return {
    type: CHANGE_CALL_VIEW,
    viewMode: mode,
  };
}

function switchToPresentationView(): SwitchToPresentationViewActionType {
  return {
    type: SWITCH_TO_PRESENTATION_VIEW,
  };
}

function switchFromPresentationView(): SwitchFromPresentationViewActionType {
  return {
    type: SWITCH_FROM_PRESENTATION_VIEW,
  };
}
export const actions = {
  acceptCall,
  approveUser,
  batchUserAction,
  blockClient,
  callStateChange,
  cancelCall,
  cancelIncomingGroupCallRing,
  cancelPresenting,
  changeCallView,
  changeIODevice,
  closeNeedPermissionScreen,
  createCallLink,
  declineCall,
  deleteCallLink,
  denyUser,
  getPresentingSources,
  groupCallAudioLevelsChange,
  groupCallEnded,
  groupCallRaisedHandsChange,
  groupCallStateChange,
  hangUpActiveCall,
  handleCallLinkUpdate,
  handleCallLinkUpdateLocal,
  handleCallLinkDelete,
  joinedAdhocCall,
  leaveCurrentCallAndStartCallingLobby,
  onOutgoingVideoCallInConversation,
  onOutgoingAudioCallInConversation,
  openSystemPreferencesAction,
  outgoingCall,
  peekGroupCallForTheFirstTime,
  peekGroupCallIfItHasMembers,
  peekNotConnectedGroupCall,
  receiveGroupCallReactions,
  receiveIncomingDirectCall,
  receiveIncomingGroupCall,
  refreshIODevices,
  remoteSharingScreenChange,
  remoteVideoChange,
  removeClient,
  returnToActiveCall,
  sendGroupCallRaiseHand,
  sendGroupCallReaction,
  selectPresentingSource,
  setGroupCallVideoRequest,
  setIsCallActive,
  setLocalAudio,
  setLocalVideo,
  setOutgoingRing,
  setRendererCanvas,
  setSuggestLowerHand,
  startCall,
  startCallLinkLobby,
  startCallLinkLobbyByRoomId,
  startCallingLobby,
  switchToPresentationView,
  switchFromPresentationView,
  toggleParticipants,
  togglePip,
  toggleScreenRecordingPermissionsDialog,
  toggleSettings,
  updateCallLinkName,
  updateCallLinkRestrictions,

  // Exported only for tests
  _setPresenting,
};

export const useCallingActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

export type ActionsType = ReadonlyDeep<typeof actions>;

// Reducer

export function getEmptyState(): CallingStateType {
  return {
    availableCameras: [],
    availableMicrophones: [],
    availableSpeakers: [],
    selectedCamera: undefined,
    selectedMicrophone: undefined,
    selectedSpeaker: undefined,

    callsByConversation: {},
    adhocCalls: {},
    activeCallState: undefined,
    callLinks: {},
  };
}

function getGroupCall(
  conversationId: string,
  state: Readonly<CallingStateType>,
  callMode: CallMode
): undefined | GroupCallStateType {
  const call =
    callMode === CallMode.Adhoc
      ? getOwn(state.adhocCalls, conversationId)
      : getOwn(state.callsByConversation, conversationId);
  return isGroupOrAdhocCallState(call) ? call : undefined;
}

function removeConversationFromState(
  state: Readonly<CallingStateType>,
  conversationId: string
): CallingStateType {
  return {
    ...(conversationId === state.activeCallState?.conversationId
      ? omit(state, 'activeCallState')
      : state),
    callsByConversation: omit(state.callsByConversation, conversationId),
    adhocCalls: omit(state.adhocCalls, conversationId),
  };
}

function mergeCallWithGroupCallLookups({
  state,
  callMode,
  conversationId,
  call,
}: {
  state: Readonly<CallingStateType>;
  callMode: CallMode;
  conversationId: string;
  call: GroupCallStateType;
}): {
  callsByConversation: CallsByConversationType;
  adhocCalls: AdhocCallsType;
} {
  const { callsByConversation, adhocCalls } = state;
  const isAdhocCall = callMode === CallMode.Adhoc;

  return {
    callsByConversation: isAdhocCall
      ? callsByConversation
      : {
          ...callsByConversation,
          [conversationId]: call,
        },
    adhocCalls: isAdhocCall
      ? {
          ...adhocCalls,
          [conversationId]: call,
        }
      : adhocCalls,
  };
}

function abortCapturer(
  state: Readonly<CallingStateType>
): Readonly<CallingStateType> {
  const { capturerBaton } = state;
  if (capturerBaton == null) {
    return state;
  }

  // Cancel source selection if running
  const capturer = globalCapturers.get(capturerBaton);
  strictAssert(capturer != null, 'Capturer reference exists, but not capturer');
  capturer.abort();

  return {
    ...state,
    capturerBaton: undefined,
  };
}

export function reducer(
  state: Readonly<CallingStateType> = getEmptyState(),
  action: Readonly<CallingActionType>
): CallingStateType {
  const { callsByConversation, adhocCalls } = state;

  if (action.type === WAITING_FOR_CALLING_LOBBY) {
    const { conversationId } = action.payload;

    return {
      ...state,
      activeCallState: {
        state: 'Waiting',
        conversationId,
      },
    };
  }
  if (action.type === WAITING_FOR_CALL_LINK_LOBBY) {
    const { roomId } = action.payload;

    return {
      ...state,
      activeCallState: {
        state: 'Waiting',
        conversationId: roomId,
      },
    };
  }
  if (action.type === CALL_LOBBY_FAILED) {
    const { conversationId } = action.payload;

    const { activeCallState } = state;
    if (!activeCallState || activeCallState.conversationId !== conversationId) {
      log.warn(
        `${action.type}: Active call does not match target conversation`
      );
    }

    return removeConversationFromState(state, conversationId);
  }
  if (
    action.type === START_CALLING_LOBBY ||
    action.type === START_CALL_LINK_LOBBY
  ) {
    const { callMode, conversationId } = action.payload;

    let call: DirectCallStateType | GroupCallStateType;
    let newAdhocCalls: AdhocCallsType;
    let outgoingRing: boolean;
    switch (callMode) {
      case CallMode.Direct:
        call = {
          callMode: CallMode.Direct,
          conversationId,
          isIncoming: false,
          isVideoCall: action.payload.hasLocalVideo,
        };
        outgoingRing = true;
        newAdhocCalls = adhocCalls;
        break;
      case CallMode.Group:
      case CallMode.Adhoc: {
        const { connectionState, joinState, peekInfo, remoteParticipants } =
          action.payload;
        // We expect to be in this state briefly. The Calling service should update the
        //   call state shortly.
        const existingCall = getGroupCall(conversationId, state, callMode);
        const ringState = getGroupCallRingState(existingCall);
        call = {
          callMode,
          conversationId,
          connectionState,
          joinState,
          localDemuxId: undefined,
          peekInfo: peekInfo ||
            existingCall?.peekInfo || {
              acis: remoteParticipants.map(({ aci }) => aci),
              pendingAcis: [],
              maxDevices: Infinity,
              deviceCount: remoteParticipants.length,
            },
          remoteParticipants,
          ...ringState,
        };

        if (callMode === CallMode.Group) {
          outgoingRing =
            !ringState.ringId &&
            !call.peekInfo?.acis.length &&
            !call.remoteParticipants.length &&
            !action.payload.isConversationTooBigToRing;
          newAdhocCalls = adhocCalls;
        } else if (callMode === CallMode.Adhoc) {
          outgoingRing = false;
          newAdhocCalls = {
            ...adhocCalls,
            [conversationId]: call,
          };
        } else {
          throw missingCaseError(action.payload);
        }
        break;
      }
      default:
        throw missingCaseError(action.payload);
    }

    const { callLinks } = state;

    const newCallsByConversation =
      callMode === CallMode.Adhoc
        ? callsByConversation
        : {
            ...callsByConversation,
            [conversationId]: call,
          };

    return {
      ...state,
      callsByConversation: newCallsByConversation,
      adhocCalls: newAdhocCalls,
      callLinks:
        action.type === START_CALL_LINK_LOBBY
          ? {
              ...callLinks,
              [conversationId]: {
                ...action.payload.callLinkState,
                roomId:
                  callLinks[conversationId]?.roomId ??
                  action.payload.callLinkRoomId,
                rootKey:
                  callLinks[conversationId]?.rootKey ??
                  action.payload.callLinkRootKey,
                adminKey: callLinks[conversationId]?.adminKey,
                storageNeedsSync: false,
              },
            }
          : callLinks,
      activeCallState: {
        state: 'Active',
        callMode,
        conversationId,
        hasLocalAudio: action.payload.hasLocalAudio,
        hasLocalVideo: action.payload.hasLocalVideo,
        localAudioLevel: 0,
        viewMode: CallViewMode.Paginated,
        pip: false,
        settingsDialogOpen: false,
        showParticipantsList: false,
        outgoingRing,
        joinedAt: null,
      },
    };
  }

  if (action.type === START_DIRECT_CALL) {
    return {
      ...state,
      callsByConversation: {
        ...callsByConversation,
        [action.payload.conversationId]: {
          callMode: CallMode.Direct,
          conversationId: action.payload.conversationId,
          callState: CallState.Prering,
          isIncoming: false,
          isVideoCall: action.payload.hasLocalVideo,
        },
      },
      activeCallState: {
        state: 'Active',
        callMode: CallMode.Direct,
        conversationId: action.payload.conversationId,
        hasLocalAudio: action.payload.hasLocalAudio,
        hasLocalVideo: action.payload.hasLocalVideo,
        localAudioLevel: 0,
        viewMode: CallViewMode.Paginated,
        pip: false,
        settingsDialogOpen: false,
        showParticipantsList: false,
        outgoingRing: true,
        joinedAt: null,
      },
    };
  }

  if (action.type === ACCEPT_CALL_PENDING) {
    const call = getOwn(
      state.callsByConversation,
      action.payload.conversationId
    );
    if (!call) {
      log.warn('Unable to accept a non-existent call');
      return state;
    }

    return {
      ...state,
      activeCallState: {
        state: 'Active',
        callMode: call.callMode,
        conversationId: action.payload.conversationId,
        hasLocalAudio: true,
        hasLocalVideo: action.payload.asVideoCall,
        localAudioLevel: 0,
        viewMode: CallViewMode.Paginated,
        pip: false,
        settingsDialogOpen: false,
        showParticipantsList: false,
        outgoingRing: false,
        joinedAt: null,
      },
    };
  }

  if (
    action.type === CANCEL_CALL ||
    action.type === HANG_UP ||
    action.type === CLOSE_NEED_PERMISSION_SCREEN
  ) {
    const updatedState = abortCapturer(state);
    const activeCall = getActiveCall(updatedState);
    if (!activeCall) {
      log.warn(`${action.type}: No active call to remove`);
      return updatedState;
    }

    switch (activeCall.callMode) {
      case CallMode.Direct:
        return removeConversationFromState(
          updatedState,
          activeCall.conversationId
        );
      case CallMode.Group:
      case CallMode.Adhoc:
        return omit(updatedState, 'activeCallState');
      default:
        throw missingCaseError(activeCall);
    }
  }

  if (action.type === CANCEL_INCOMING_GROUP_CALL_RING) {
    const { conversationId, ringId } = action.payload;

    const groupCall = getGroupCall(conversationId, state, CallMode.Group);
    if (!groupCall || groupCall.ringId !== ringId) {
      return state;
    }

    return {
      ...state,
      callsByConversation: {
        ...callsByConversation,
        [conversationId]: omit(groupCall, ['ringId', 'ringerAci']),
      },
    };
  }

  if (action.type === 'CONVERSATIONS_UPDATED') {
    const activeCall = getActiveCall(state);
    const { activeCallState } = state;

    if (
      activeCallState?.state === 'Waiting' ||
      !activeCallState?.outgoingRing ||
      !isGroupOrAdhocCallState(activeCall) ||
      activeCall.joinState !== GroupCallJoinState.NotJoined
    ) {
      return state;
    }

    const conversationForActiveCall = action.payload.data
      .slice()
      // reverse list since last update takes precedence
      .reverse()
      .find(conversation => conversation.id === activeCall?.conversationId);

    if (
      !conversationForActiveCall ||
      !isConversationTooBigToRing(conversationForActiveCall)
    ) {
      return state;
    }

    return {
      ...state,
      activeCallState: { ...activeCallState, outgoingRing: false },
    };
  }

  if (action.type === 'CONVERSATION_REMOVED') {
    return removeConversationFromState(state, action.payload.id);
  }

  if (action.type === DECLINE_DIRECT_CALL) {
    return removeConversationFromState(state, action.payload.conversationId);
  }

  if (action.type === INCOMING_DIRECT_CALL) {
    return {
      ...state,
      callsByConversation: {
        ...callsByConversation,
        [action.payload.conversationId]: {
          callMode: CallMode.Direct,
          conversationId: action.payload.conversationId,
          callState: CallState.Prering,
          isIncoming: true,
          isVideoCall: action.payload.isVideoCall,
        },
      },
    };
  }

  if (action.type === INCOMING_GROUP_CALL) {
    const { conversationId, ringId, ringerAci } = action.payload;

    let groupCall: GroupCallStateType;
    const existingGroupCall = getGroupCall(
      conversationId,
      state,
      CallMode.Group
    );
    if (existingGroupCall) {
      if (existingGroupCall.ringerAci) {
        log.info('Group call was already ringing');
        return state;
      }
      if (existingGroupCall.joinState !== GroupCallJoinState.NotJoined) {
        log.info("Got a ring for a call we're already in");
        return state;
      }

      groupCall = {
        ...existingGroupCall,
        ringId,
        ringerAci,
      };
    } else {
      groupCall = {
        callMode: CallMode.Group,
        conversationId,
        connectionState: GroupCallConnectionState.NotConnected,
        joinState: GroupCallJoinState.NotJoined,
        localDemuxId: undefined,
        peekInfo: {
          acis: [],
          pendingAcis: [],
          maxDevices: Infinity,
          deviceCount: 0,
        },
        remoteParticipants: [],
        ringId,
        ringerAci,
      };
    }

    return {
      ...state,
      callsByConversation: {
        ...callsByConversation,
        [conversationId]: groupCall,
      },
    };
  }

  if (action.type === OUTGOING_CALL) {
    return {
      ...state,
      callsByConversation: {
        ...callsByConversation,
        [action.payload.conversationId]: {
          callMode: CallMode.Direct,
          conversationId: action.payload.conversationId,
          callState: CallState.Prering,
          isIncoming: false,
          isVideoCall: action.payload.hasLocalVideo,
        },
      },
      activeCallState: {
        state: 'Active',
        callMode: CallMode.Direct,
        conversationId: action.payload.conversationId,
        hasLocalAudio: action.payload.hasLocalAudio,
        hasLocalVideo: action.payload.hasLocalVideo,
        localAudioLevel: 0,
        viewMode: CallViewMode.Paginated,
        pip: false,
        settingsDialogOpen: false,
        showParticipantsList: false,
        outgoingRing: true,
        joinedAt: null,
      },
    };
  }

  if (action.type === CALL_STATE_CHANGE_FULFILLED) {
    const call = getOwn(
      state.callsByConversation,
      action.payload.conversationId
    );

    if (
      call?.callMode === CallMode.Direct &&
      call?.callState !== action.payload.callState
    ) {
      drop(
        calling.notifyScreenShareStatus({
          callMode: CallMode.Direct,
          callState: action.payload.callState,
          isPresenting:
            state.activeCallState?.state === 'Active' &&
            state.activeCallState?.presentingSource != null,
          conversationId: state.activeCallState?.conversationId,
        })
      );
    }

    // We want to keep the state around for ended calls if they resulted in a message
    //   request so we can show the "needs permission" screen.
    if (
      action.payload.callState === CallState.Ended &&
      action.payload.callEndedReason !==
        CallEndedReason.RemoteHangupNeedPermission
    ) {
      return removeConversationFromState(state, action.payload.conversationId);
    }

    if (call?.callMode !== CallMode.Direct) {
      log.warn('Cannot update state for a non-direct call');
      return state;
    }

    let activeCallState: undefined | ActiveCallStateType | WaitingCallStateType;
    if (
      state.activeCallState?.conversationId === action.payload.conversationId &&
      state.activeCallState.state === 'Active'
    ) {
      activeCallState = {
        ...state.activeCallState,
        joinedAt: action.payload.acceptedTime ?? null,
      };
    } else {
      ({ activeCallState } = state);
    }

    return {
      ...state,
      callsByConversation: {
        ...callsByConversation,
        [action.payload.conversationId]: {
          ...call,
          callState: action.payload.callState,
          callEndedReason: action.payload.callEndedReason,
        },
      },
      activeCallState,
    };
  }

  if (action.type === GROUP_CALL_AUDIO_LEVELS_CHANGE) {
    const { callMode, conversationId, remoteDeviceStates } = action.payload;

    const { activeCallState } = state;
    const existingCall = getGroupCall(conversationId, state, callMode);

    // The PiP check is an optimization. We don't need to update audio levels if the user
    //   cannot see them.
    if (
      !activeCallState ||
      activeCallState.state === 'Waiting' ||
      activeCallState.pip ||
      !existingCall
    ) {
      return state;
    }

    const localAudioLevel = truncateAudioLevel(action.payload.localAudioLevel);

    const remoteAudioLevels = new Map<number, number>();
    remoteDeviceStates.forEach(({ audioLevel, demuxId }) => {
      // We expect `audioLevel` to be a number but have this check just in case.
      if (typeof audioLevel !== 'number') {
        return;
      }

      const graded = truncateAudioLevel(audioLevel);
      if (graded > 0) {
        remoteAudioLevels.set(demuxId, graded);
      }
    });

    // This action is dispatched frequently. This equality check helps avoid re-renders.
    const oldLocalAudioLevel = activeCallState.localAudioLevel;
    const oldRemoteAudioLevels = existingCall.remoteAudioLevels;
    if (
      oldLocalAudioLevel === localAudioLevel &&
      oldRemoteAudioLevels &&
      mapUtil.isEqual(oldRemoteAudioLevels, remoteAudioLevels)
    ) {
      return state;
    }

    return {
      ...state,
      activeCallState: { ...activeCallState, localAudioLevel },
      ...mergeCallWithGroupCallLookups({
        state,
        callMode: existingCall.callMode,
        conversationId,
        call: { ...existingCall, remoteAudioLevels },
      }),
    };
  }

  if (action.type === GROUP_CALL_STATE_CHANGE) {
    const {
      callMode,
      connectionState,
      conversationId,
      hasLocalAudio,
      hasLocalVideo,
      localDemuxId,
      joinState,
      ourAci,
      peekInfo,
      remoteParticipants,
    } = action.payload;

    const existingCall = getGroupCall(conversationId, state, callMode);
    const existingRingState = getGroupCallRingState(existingCall);

    // Generare a better log line that would help piece together ACIs and
    // demuxIds.
    const currentlyInCall = new Map(
      existingCall?.remoteParticipants.map(({ demuxId, aci }) => [
        demuxId,
        aci,
      ]) ?? []
    );
    const nextInCall = new Map(
      remoteParticipants.map(({ demuxId, aci }) => [demuxId, aci]) ?? []
    );

    const membersLeft = new Array<`${AciString}:${number}`>();
    for (const [demuxId, aci] of currentlyInCall) {
      if (!nextInCall.has(demuxId)) {
        membersLeft.push(`${aci}:${demuxId}`);
      }
    }

    const membersJoined = new Array<`${AciString}:${number}`>();
    for (const [demuxId, aci] of nextInCall) {
      if (!currentlyInCall.has(demuxId)) {
        membersJoined.push(`${aci}:${demuxId}`);
      }
    }

    let callLinkLog = '';
    if (callMode === CallMode.Adhoc) {
      const currentPendingAcis = new Set(
        existingCall?.peekInfo?.pendingAcis ?? []
      );
      const nextPendingAcis = new Set(peekInfo?.pendingAcis ?? []);
      const pendingAcisLeft = new Array<AciString>();
      const pendingAcisJoined = new Array<AciString>();
      for (const aci of currentPendingAcis) {
        if (!nextPendingAcis.has(aci)) {
          pendingAcisLeft.push(aci);
        }
      }
      for (const aci of nextPendingAcis) {
        if (!currentPendingAcis.has(aci)) {
          pendingAcisJoined.push(aci);
        }
      }
      callLinkLog =
        `joinPending={${pendingAcisJoined.join(', ')}} ` +
        `leftPending={${pendingAcisLeft.join(', ')}}`;
    }

    log.info(
      'groupCallStateChange:',
      conversationId,
      GroupCallConnectionState[connectionState],
      GroupCallJoinState[joinState],
      `joined={${membersJoined.join(', ')}}`,
      `left={${membersLeft.join(', ')}}`,
      callLinkLog
    );

    const newPeekInfo = peekInfo ||
      existingCall?.peekInfo || {
        acis: remoteParticipants.map(({ aci }) => aci),
        pendingAcis: [],
        maxDevices: Infinity,
        deviceCount: remoteParticipants.length,
      };

    let newActiveCallState:
      | undefined
      | ActiveCallStateType
      | WaitingCallStateType;
    if (
      state.activeCallState?.state === 'Active' &&
      state.activeCallState?.conversationId === conversationId
    ) {
      if (connectionState === GroupCallConnectionState.NotConnected) {
        newActiveCallState = undefined;
      } else {
        const joinedAt =
          state.activeCallState.joinedAt ??
          (connectionState === GroupCallConnectionState.Connected
            ? new Date().getTime()
            : null);

        newActiveCallState = {
          ...state.activeCallState,
          hasLocalAudio,
          hasLocalVideo,
          joinedAt,
        };
      }

      // The first time we detect call participants in the lobby, check participant count
      // and mute ourselves if over the threshold.
      if (
        joinState === GroupCallJoinState.NotJoined &&
        !isAnybodyInGroupCall(existingCall?.peekInfo) &&
        newPeekInfo.deviceCount >= MAX_CALL_PARTICIPANTS_FOR_DEFAULT_MUTE &&
        newActiveCallState?.hasLocalAudio
      ) {
        newActiveCallState.hasLocalAudio = false;
      }
    } else {
      newActiveCallState = state.activeCallState;
    }

    if (
      newActiveCallState &&
      newActiveCallState.state === 'Active' &&
      newActiveCallState.outgoingRing &&
      newActiveCallState.conversationId === conversationId &&
      isAnybodyElseInGroupCall(newPeekInfo, ourAci)
    ) {
      newActiveCallState = {
        ...newActiveCallState,
        outgoingRing: false,
      };
    }

    let newRingState: GroupCallRingStateType;
    if (joinState === GroupCallJoinState.NotJoined) {
      newRingState = existingRingState;
    } else {
      newRingState = {};
    }

    const call = {
      callMode,
      conversationId,
      connectionState,
      joinState,
      localDemuxId,
      peekInfo: newPeekInfo,
      remoteParticipants,
      raisedHands: existingCall?.raisedHands ?? [],
      ...newRingState,
    };

    if (existingCall?.connectionState !== connectionState) {
      drop(
        calling.notifyScreenShareStatus({
          callMode,
          connectionState,
          isPresenting:
            state.activeCallState?.state === 'Active' &&
            state.activeCallState?.presentingSource != null,
          conversationId: state.activeCallState?.conversationId,
        })
      );
    }

    return {
      ...state,
      ...mergeCallWithGroupCallLookups({
        state,
        callMode,
        conversationId,
        call,
      }),
      activeCallState: newActiveCallState,
    };
  }

  if (action.type === PEEK_GROUP_CALL_FULFILLED) {
    const { callMode, conversationId, peekInfo } = action.payload;
    if (!isGroupOrAdhocCallMode(callMode)) {
      return state;
    }

    const existingCall: GroupCallStateType = getGroupCall(
      conversationId,
      state,
      callMode
    ) || {
      callMode,
      conversationId,
      connectionState: GroupCallConnectionState.NotConnected,
      joinState: GroupCallJoinState.NotJoined,
      localDemuxId: undefined,
      peekInfo: {
        acis: [],
        pendingAcis: [],
        maxDevices: Infinity,
        deviceCount: 0,
      },
      remoteParticipants: [],
    };

    // This action should only update non-connected group calls. It's not necessarily a
    //   mistake if this action is dispatched "over" a connected call. Here's a valid
    //   sequence of events:
    //
    // 1. We ask RingRTC to peek, kicking off an asynchronous operation.
    // 2. The associated group call is joined.
    // 3. The peek promise from step 1 resolves.
    if (
      existingCall.connectionState !== GroupCallConnectionState.NotConnected
    ) {
      return state;
    }

    return {
      ...state,
      ...mergeCallWithGroupCallLookups({
        state,
        callMode: existingCall.callMode,
        conversationId,
        call: { ...existingCall, peekInfo },
      }),
    };
  }

  if (action.type === SET_CAPTURER_BATON) {
    return {
      ...abortCapturer(state),
      capturerBaton: action.payload,
    };
  }

  if (
    action.type === SEND_GROUP_CALL_REACTION ||
    action.type === GROUP_CALL_REACTIONS_RECEIVED
  ) {
    const { callMode, conversationId, timestamp } = action.payload;
    if (
      state.activeCallState?.state === 'Waiting' ||
      state.activeCallState?.conversationId !== conversationId
    ) {
      return state;
    }

    let recentReactions: Array<ActiveCallReaction> = [];
    if (action.type === GROUP_CALL_REACTIONS_RECEIVED) {
      recentReactions = action.payload.reactions.map(({ demuxId, value }) => {
        return { timestamp, demuxId, value };
      });
    } else {
      // When sending reactions, ringrtc doesn't automatically receive back a copy of
      // the reaction you just sent. We handle it here and add a local copy to state.
      const existingGroupCall = getGroupCall(conversationId, state, callMode);
      if (!existingGroupCall) {
        log.warn(
          'Unable to update group call reactions after send reaction because existing group call is missing.'
        );
        return state;
      }

      // This should never happen -- localDemuxId is set when a call enters the
      // Joining state, and Reactions are only usable from the CallScreen which is
      // shown when the call is in the Joined state (after Joining).
      if (!existingGroupCall.localDemuxId) {
        log.warn(
          'Unable to update group call reactions after send reaction because localDemuxId is missing.'
        );
        return state;
      }

      recentReactions = [
        {
          timestamp,
          demuxId: existingGroupCall.localDemuxId,
          value: action.payload.value,
        },
      ];
    }

    return {
      ...state,
      activeCallState: {
        ...state.activeCallState,
        reactions: [
          ...(state.activeCallState.reactions ?? []),
          ...recentReactions,
        ].slice(-MAX_CALLING_REACTIONS),
      },
    };
  }

  if (action.type === GROUP_CALL_REACTIONS_EXPIRED) {
    const { conversationId, timestamp: receivedAt } = action.payload;
    if (
      state.activeCallState?.state === 'Waiting' ||
      state.activeCallState?.conversationId !== conversationId ||
      !state.activeCallState?.reactions
    ) {
      return state;
    }

    const expireAt = receivedAt + CALLING_REACTIONS_LIFETIME;

    return {
      ...state,
      activeCallState: {
        ...state.activeCallState,
        reactions: state.activeCallState.reactions.filter(({ timestamp }) => {
          return timestamp > expireAt;
        }),
      },
    };
  }

  if (action.type === GROUP_CALL_RAISED_HANDS_CHANGE) {
    const { callMode, conversationId, raisedHands } = action.payload;

    const { activeCallState } = state;
    const existingCall = getGroupCall(conversationId, state, callMode);

    if (
      state.activeCallState?.conversationId !== conversationId ||
      !activeCallState ||
      !existingCall
    ) {
      return state;
    }

    return {
      ...state,
      ...mergeCallWithGroupCallLookups({
        state,
        callMode: existingCall.callMode,
        conversationId,
        call: { ...existingCall, raisedHands: [...raisedHands] },
      }),
    };
  }

  if (action.type === REMOTE_SHARING_SCREEN_CHANGE) {
    const { conversationId, isSharingScreen } = action.payload;
    const call = getOwn(state.callsByConversation, conversationId);
    if (call?.callMode !== CallMode.Direct) {
      log.warn('Cannot update remote video for a non-direct call');
      return state;
    }

    return {
      ...state,
      callsByConversation: {
        ...callsByConversation,
        [conversationId]: {
          ...call,
          isSharingScreen,
        },
      },
    };
  }

  if (action.type === REMOTE_VIDEO_CHANGE) {
    const { conversationId, hasVideo } = action.payload;
    const call = getOwn(state.callsByConversation, conversationId);
    if (call?.callMode !== CallMode.Direct) {
      log.warn('Cannot update remote video for a non-direct call');
      return state;
    }

    return {
      ...state,
      callsByConversation: {
        ...callsByConversation,
        [conversationId]: {
          ...call,
          hasRemoteVideo: hasVideo,
        },
      },
    };
  }

  if (action.type === RETURN_TO_ACTIVE_CALL) {
    const { activeCallState } = state;
    if (activeCallState?.state !== 'Active') {
      log.warn('Cannot return to active call if there is no active call');
      return state;
    }

    return {
      ...state,
      activeCallState: {
        ...activeCallState,
        pip: false,
      },
    };
  }

  if (action.type === SET_LOCAL_AUDIO_FULFILLED) {
    if (state.activeCallState?.state !== 'Active') {
      log.warn('Cannot set local audio with no active call');
      return state;
    }

    return {
      ...state,
      activeCallState: {
        ...state.activeCallState,
        hasLocalAudio: action.payload.enabled,
      },
    };
  }

  if (action.type === SET_LOCAL_VIDEO_FULFILLED) {
    if (state.activeCallState?.state !== 'Active') {
      log.warn('Cannot set local video with no active call');
      return state;
    }

    return {
      ...state,
      activeCallState: {
        ...state.activeCallState,
        hasLocalVideo: action.payload.enabled,
      },
    };
  }

  if (action.type === CHANGE_IO_DEVICE_FULFILLED) {
    const { selectedDevice } = action.payload;
    const nextState = Object.create(null);

    if (action.payload.type === CallingDeviceType.CAMERA) {
      nextState.selectedCamera = selectedDevice;
    } else if (action.payload.type === CallingDeviceType.MICROPHONE) {
      nextState.selectedMicrophone = selectedDevice;
    } else if (action.payload.type === CallingDeviceType.SPEAKER) {
      nextState.selectedSpeaker = selectedDevice;
    }

    return {
      ...state,
      ...nextState,
    };
  }

  if (action.type === REFRESH_IO_DEVICES) {
    const {
      availableMicrophones,
      selectedMicrophone,
      availableSpeakers,
      selectedSpeaker,
      availableCameras,
      selectedCamera,
    } = action.payload;

    return {
      ...state,
      availableMicrophones,
      selectedMicrophone,
      availableSpeakers,
      selectedSpeaker,
      availableCameras,
      selectedCamera,
    };
  }

  if (action.type === TOGGLE_SETTINGS) {
    const { activeCallState } = state;
    if (activeCallState?.state !== 'Active') {
      log.warn('Cannot toggle settings when there is no active call');
      return state;
    }

    return {
      ...state,
      activeCallState: {
        ...activeCallState,
        settingsDialogOpen: !activeCallState.settingsDialogOpen,
      },
    };
  }

  if (action.type === TOGGLE_PARTICIPANTS) {
    const { activeCallState } = state;
    if (activeCallState?.state !== 'Active') {
      log.warn('Cannot toggle participants list when there is no active call');
      return state;
    }

    return {
      ...state,
      activeCallState: {
        ...activeCallState,
        showParticipantsList: !activeCallState.showParticipantsList,
      },
    };
  }

  if (action.type === TOGGLE_PIP) {
    const { activeCallState } = state;
    if (activeCallState?.state !== 'Active') {
      log.warn('Cannot toggle PiP when there is no active call');
      return state;
    }

    return {
      ...state,
      activeCallState: {
        ...activeCallState,
        pip: !activeCallState.pip,
      },
    };
  }

  if (action.type === SET_PRESENTING) {
    const { activeCallState } = state;

    if (activeCallState?.state !== 'Active') {
      log.warn('Cannot toggle presenting when there is no active call');
      return state;
    }

    return {
      ...(action.payload == null ? abortCapturer(state) : state),
      activeCallState: {
        ...activeCallState,
        presentingSource: action.payload,
        presentingSourcesAvailable: undefined,
      },
    };
  }

  if (action.type === SET_PRESENTING_SOURCES) {
    const { activeCallState } = state;
    if (activeCallState?.state !== 'Active') {
      log.warn('Cannot set presenting sources when there is no active call');
      return state;
    }

    return {
      ...state,
      activeCallState: {
        ...activeCallState,
        presentingSourcesAvailable: action.payload.presentableSources,
      },
    };
  }

  if (action.type === SELECT_PRESENTING_SOURCE) {
    const { activeCallState, capturerBaton } = state;
    if (activeCallState?.state !== 'Active') {
      log.warn('Cannot set presenting sources when there is no active call');
      return state;
    }

    const { presentingSourcesAvailable } = activeCallState;
    if (!capturerBaton || !presentingSourcesAvailable) {
      log.warn(
        'Cannot set presenting sources when there is no presenting modal'
      );
      return state;
    }

    const capturer = globalCapturers.get(capturerBaton);
    if (!capturer) {
      log.warn('Cannot toggle presenting when there is no capturer');
      return state;
    }
    capturer.selectSource(action.payload);

    return {
      ...state,
      capturerBaton: undefined,
      activeCallState: {
        ...activeCallState,
        presentingSource: presentingSourcesAvailable.find(
          source => source.id === action.payload
        ),
        presentingSourcesAvailable: undefined,
      },
    };
  }

  if (action.type === SET_OUTGOING_RING) {
    const { activeCallState } = state;
    if (activeCallState?.state !== 'Active') {
      log.warn('Cannot set outgoing ring when there is no active call');
      return state;
    }

    return {
      ...state,
      activeCallState: {
        ...activeCallState,
        outgoingRing: action.payload,
      },
    };
  }

  if (action.type === TOGGLE_NEEDS_SCREEN_RECORDING_PERMISSIONS) {
    const { activeCallState } = state;
    if (activeCallState?.state !== 'Active') {
      log.warn('Cannot set presenting sources when there is no active call');
      return state;
    }

    return {
      ...state,
      activeCallState: {
        ...activeCallState,
        showNeedsScreenRecordingPermissionsWarning:
          !activeCallState.showNeedsScreenRecordingPermissionsWarning,
      },
    };
  }

  if (action.type === CHANGE_CALL_VIEW) {
    const { activeCallState } = state;
    if (activeCallState?.state !== 'Active') {
      log.warn('Cannot change call view when there is no active call');
      return state;
    }

    if (activeCallState.viewMode === action.viewMode) {
      return state;
    }

    return {
      ...state,
      activeCallState: {
        ...activeCallState,
        viewMode: action.viewMode,
        viewModeBeforePresentation:
          action.viewMode === CallViewMode.Presentation
            ? activeCallState.viewMode
            : undefined,
      },
    };
  }

  if (action.type === SWITCH_TO_PRESENTATION_VIEW) {
    const { activeCallState } = state;
    if (activeCallState?.state !== 'Active') {
      log.warn('Cannot switch to speaker view when there is no active call');
      return state;
    }

    if (activeCallState.viewMode === CallViewMode.Presentation) {
      return state;
    }

    return {
      ...state,
      activeCallState: {
        ...activeCallState,
        viewMode: CallViewMode.Presentation,
        viewModeBeforePresentation: activeCallState.viewMode,
      },
    };
  }

  if (action.type === SWITCH_FROM_PRESENTATION_VIEW) {
    const { activeCallState } = state;
    if (activeCallState?.state !== 'Active') {
      log.warn('Cannot switch to speaker view when there is no active call');
      return state;
    }

    if (activeCallState.viewMode !== CallViewMode.Presentation) {
      return state;
    }

    return {
      ...state,
      activeCallState: {
        ...activeCallState,
        viewMode:
          activeCallState.viewModeBeforePresentation ?? CallViewMode.Paginated,
      },
    };
  }

  if (action.type === HANDLE_CALL_LINK_UPDATE) {
    const { callLinks } = state;
    const { callLink } = action.payload;
    const { roomId } = callLink;

    return {
      ...state,
      callLinks: {
        ...callLinks,
        [roomId]: callLink,
      },
    };
  }

  if (action.type === HANDLE_CALL_LINK_DELETE) {
    const { roomId } = action.payload;

    return {
      ...state,
      callLinks: omit(state.callLinks, roomId),
    };
  }

  if (action.type === SUGGEST_LOWER_HAND) {
    const { suggestLowerHand } = action.payload;
    const { activeCallState } = state;

    if (activeCallState?.state !== 'Active') {
      log.warn('Cannot suggest lower hand when there is no active call');
      return state;
    }

    return {
      ...state,
      activeCallState: {
        ...activeCallState,
        suggestLowerHand,
      },
    };
  }

  return state;
}
