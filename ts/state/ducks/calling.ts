// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';
import type { ThunkAction, ThunkDispatch } from 'redux-thunk';
import { CallEndedReason } from 'ringrtc';
import {
  hasScreenCapturePermission,
  openSystemPreferences,
} from 'mac-screen-capture-permissions';
import { has, omit } from 'lodash';
import { getOwn } from '../../util/getOwn';
import * as Errors from '../../types/errors';
import { getPlatform } from '../selectors/user';
import { isConversationTooBigToRing } from '../../conversations/isConversationTooBigToRing';
import { missingCaseError } from '../../util/missingCaseError';
import { calling } from '../../services/calling';
import { truncateAudioLevel } from '../../calling/truncateAudioLevel';
import type { StateType as RootStateType } from '../reducer';
import type {
  ChangeIODevicePayloadType,
  GroupCallVideoRequest,
  MediaDeviceSettings,
  PresentedSource,
  PresentableSource,
} from '../../types/Calling';
import {
  CallingDeviceType,
  CallMode,
  CallViewMode,
  CallState,
  GroupCallConnectionState,
  GroupCallJoinState,
} from '../../types/Calling';
import { callingTones } from '../../util/callingTones';
import { requestCameraPermissions } from '../../util/callingPermissions';
import { isGroupCallOutboundRingEnabled } from '../../util/isGroupCallOutboundRingEnabled';
import { sleep } from '../../util/sleep';
import { LatestQueue } from '../../util/LatestQueue';
import type { UUIDStringType } from '../../types/UUID';
import type {
  ConversationChangedActionType,
  ConversationRemovedActionType,
} from './conversations';
import { getConversationCallMode } from './conversations';
import * as log from '../../logging/log';
import { strictAssert } from '../../util/assert';
import { waitForOnline } from '../../util/waitForOnline';
import * as mapUtil from '../../util/mapUtil';

// State

export type GroupCallPeekInfoType = {
  uuids: Array<UUIDStringType>;
  creatorUuid?: UUIDStringType;
  eraId?: string;
  maxDevices: number;
  deviceCount: number;
};

export type GroupCallParticipantInfoType = {
  uuid: UUIDStringType;
  demuxId: number;
  hasRemoteAudio: boolean;
  hasRemoteVideo: boolean;
  presenting: boolean;
  sharingScreen: boolean;
  speakerTime?: number;
  videoAspectRatio: number;
};

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

type GroupCallRingStateType =
  | {
      ringId?: undefined;
      ringerUuid?: undefined;
    }
  | {
      ringId: bigint;
      ringerUuid: UUIDStringType;
    };

export type GroupCallStateType = {
  callMode: CallMode.Group;
  conversationId: string;
  connectionState: GroupCallConnectionState;
  joinState: GroupCallJoinState;
  peekInfo?: GroupCallPeekInfoType;
  remoteParticipants: Array<GroupCallParticipantInfoType>;
  remoteAudioLevels?: Map<number, number>;
} & GroupCallRingStateType;

export type ActiveCallStateType = {
  conversationId: string;
  hasLocalAudio: boolean;
  hasLocalVideo: boolean;
  localAudioLevel: number;
  viewMode: CallViewMode;
  joinedAt?: number;
  outgoingRing: boolean;
  pip: boolean;
  presentingSource?: PresentedSource;
  presentingSourcesAvailable?: Array<PresentableSource>;
  safetyNumberChangedUuids: Array<UUIDStringType>;
  settingsDialogOpen: boolean;
  showNeedsScreenRecordingPermissionsWarning?: boolean;
  showParticipantsList: boolean;
};

export type CallsByConversationType = {
  [conversationId: string]: DirectCallStateType | GroupCallStateType;
};

export type CallingStateType = MediaDeviceSettings & {
  callsByConversation: CallsByConversationType;
  activeCallState?: ActiveCallStateType;
};

export type AcceptCallType = {
  conversationId: string;
  asVideoCall: boolean;
};

export type CallStateChangeType = {
  conversationId: string;
  acceptedTime?: number;
  callState: CallState;
  callEndedReason?: CallEndedReason;
  isIncoming: boolean;
  isVideoCall: boolean;
  title: string;
};

export type CancelCallType = {
  conversationId: string;
};

type CancelIncomingGroupCallRingType = {
  conversationId: string;
  ringId: bigint;
};

export type DeclineCallType = {
  conversationId: string;
};

type GroupCallStateChangeArgumentType = {
  connectionState: GroupCallConnectionState;
  conversationId: string;
  hasLocalAudio: boolean;
  hasLocalVideo: boolean;
  joinState: GroupCallJoinState;
  peekInfo?: GroupCallPeekInfoType;
  remoteParticipants: Array<GroupCallParticipantInfoType>;
};

type GroupCallStateChangeActionPayloadType =
  GroupCallStateChangeArgumentType & {
    ourUuid: UUIDStringType;
  };

type HangUpActionPayloadType = {
  conversationId: string;
};

type KeyChangedType = {
  uuid: UUIDStringType;
};

export type KeyChangeOkType = {
  conversationId: string;
};

export type IncomingDirectCallType = {
  conversationId: string;
  isVideoCall: boolean;
};

type IncomingGroupCallType = {
  conversationId: string;
  ringId: bigint;
  ringerUuid: UUIDStringType;
};

type PeekNotConnectedGroupCallType = {
  conversationId: string;
};

type StartDirectCallType = {
  conversationId: string;
  hasLocalAudio: boolean;
  hasLocalVideo: boolean;
};

export type StartCallType = StartDirectCallType & {
  callMode: CallMode.Direct | CallMode.Group;
};

export type RemoteVideoChangeType = {
  conversationId: string;
  hasVideo: boolean;
};

type RemoteSharingScreenChangeType = {
  conversationId: string;
  isSharingScreen: boolean;
};

export type SetLocalAudioType = {
  enabled: boolean;
};

export type SetLocalVideoType = {
  enabled: boolean;
};

export type SetGroupCallVideoRequestType = {
  conversationId: string;
  resolutions: Array<GroupCallVideoRequest>;
};

export type StartCallingLobbyType = {
  conversationId: string;
  isVideoCall: boolean;
};

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

export type SetLocalPreviewType = {
  element: React.RefObject<HTMLVideoElement> | undefined;
};

export type SetRendererCanvasType = {
  element: React.RefObject<HTMLCanvasElement> | undefined;
};

// Helpers

export const getActiveCall = ({
  activeCallState,
  callsByConversation,
}: CallingStateType): undefined | DirectCallStateType | GroupCallStateType =>
  activeCallState &&
  getOwn(callsByConversation, activeCallState.conversationId);

// In theory, there could be multiple incoming calls, or an incoming call while there's
//   an active call. In practice, the UI is not ready for this, and RingRTC doesn't
//   support it for direct calls.
export const getIncomingCall = (
  callsByConversation: Readonly<CallsByConversationType>,
  ourUuid: UUIDStringType
): undefined | DirectCallStateType | GroupCallStateType =>
  Object.values(callsByConversation).find(call => {
    switch (call.callMode) {
      case CallMode.Direct:
        return call.isIncoming && call.callState === CallState.Ringing;
      case CallMode.Group:
        return (
          call.ringerUuid &&
          call.connectionState === GroupCallConnectionState.NotConnected &&
          isAnybodyElseInGroupCall(call.peekInfo, ourUuid)
        );
      default:
        throw missingCaseError(call);
    }
  });

export const isAnybodyElseInGroupCall = (
  peekInfo: undefined | Readonly<Pick<GroupCallPeekInfoType, 'uuids'>>,
  ourUuid: UUIDStringType
): boolean => Boolean(peekInfo?.uuids.some(id => id !== ourUuid));

const getGroupCallRingState = (
  call: Readonly<undefined | GroupCallStateType>
): GroupCallRingStateType =>
  call?.ringId === undefined
    ? {}
    : { ringId: call.ringId, ringerUuid: call.ringerUuid };

// We might call this function many times in rapid succession (for example, if lots of
//   people are joining and leaving at once). We want to make sure to update eventually
//   (if people join and leave for an hour, we don't want you to have to wait an hour to
//   get an update), and we also don't want to update too often. That's why we use a
//   "latest queue".
const peekQueueByConversation = new Map<string, LatestQueue>();
const doGroupCallPeek = (
  conversationId: string,
  dispatch: ThunkDispatch<
    RootStateType,
    unknown,
    PeekGroupCallFulfilledActionType
  >,
  getState: () => RootStateType
) => {
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
      existingCall?.callMode === CallMode.Group &&
      existingCall.connectionState !== GroupCallConnectionState.NotConnected
    ) {
      return;
    }

    // If we peek right after receiving the message, we may get outdated information.
    //   This is most noticeable when someone leaves. We add a delay and then make sure
    //   to only be peeking once.
    await Promise.all([sleep(1000), waitForOnline(navigator, window)]);

    let peekInfo;
    try {
      peekInfo = await calling.peekGroupCall(conversationId);
    } catch (err) {
      log.error('Group call peeking failed', Errors.toLogFormat(err));
      return;
    }

    if (!peekInfo) {
      return;
    }

    log.info(
      `doGroupCallPeek/groupv2(${conversation.groupId}): Found ${peekInfo.deviceCount} devices`
    );

    await calling.updateCallHistoryForGroupCall(conversationId, peekInfo);

    const formattedPeekInfo = calling.formatGroupCallPeekInfoForRedux(peekInfo);

    dispatch({
      type: PEEK_GROUP_CALL_FULFILLED,
      payload: {
        conversationId,
        peekInfo: formattedPeekInfo,
      },
    });
  });
};

// Actions

const ACCEPT_CALL_PENDING = 'calling/ACCEPT_CALL_PENDING';
const CANCEL_CALL = 'calling/CANCEL_CALL';
const CANCEL_INCOMING_GROUP_CALL_RING =
  'calling/CANCEL_INCOMING_GROUP_CALL_RING';
const START_CALLING_LOBBY = 'calling/START_CALLING_LOBBY';
const CALL_STATE_CHANGE_FULFILLED = 'calling/CALL_STATE_CHANGE_FULFILLED';
const CHANGE_IO_DEVICE_FULFILLED = 'calling/CHANGE_IO_DEVICE_FULFILLED';
const CLOSE_NEED_PERMISSION_SCREEN = 'calling/CLOSE_NEED_PERMISSION_SCREEN';
const DECLINE_DIRECT_CALL = 'calling/DECLINE_DIRECT_CALL';
const GROUP_CALL_AUDIO_LEVELS_CHANGE = 'calling/GROUP_CALL_AUDIO_LEVELS_CHANGE';
const GROUP_CALL_STATE_CHANGE = 'calling/GROUP_CALL_STATE_CHANGE';
const HANG_UP = 'calling/HANG_UP';
const INCOMING_DIRECT_CALL = 'calling/INCOMING_DIRECT_CALL';
const INCOMING_GROUP_CALL = 'calling/INCOMING_GROUP_CALL';
const MARK_CALL_TRUSTED = 'calling/MARK_CALL_TRUSTED';
const MARK_CALL_UNTRUSTED = 'calling/MARK_CALL_UNTRUSTED';
const OUTGOING_CALL = 'calling/OUTGOING_CALL';
const PEEK_GROUP_CALL_FULFILLED = 'calling/PEEK_GROUP_CALL_FULFILLED';
const REFRESH_IO_DEVICES = 'calling/REFRESH_IO_DEVICES';
const REMOTE_SHARING_SCREEN_CHANGE = 'calling/REMOTE_SHARING_SCREEN_CHANGE';
const REMOTE_VIDEO_CHANGE = 'calling/REMOTE_VIDEO_CHANGE';
const RETURN_TO_ACTIVE_CALL = 'calling/RETURN_TO_ACTIVE_CALL';
const SET_LOCAL_AUDIO_FULFILLED = 'calling/SET_LOCAL_AUDIO_FULFILLED';
const SET_LOCAL_VIDEO_FULFILLED = 'calling/SET_LOCAL_VIDEO_FULFILLED';
const SET_OUTGOING_RING = 'calling/SET_OUTGOING_RING';
const SET_PRESENTING = 'calling/SET_PRESENTING';
const SET_PRESENTING_SOURCES = 'calling/SET_PRESENTING_SOURCES';
const TOGGLE_NEEDS_SCREEN_RECORDING_PERMISSIONS =
  'calling/TOGGLE_NEEDS_SCREEN_RECORDING_PERMISSIONS';
const START_DIRECT_CALL = 'calling/START_DIRECT_CALL';
const TOGGLE_PARTICIPANTS = 'calling/TOGGLE_PARTICIPANTS';
const TOGGLE_PIP = 'calling/TOGGLE_PIP';
const TOGGLE_SETTINGS = 'calling/TOGGLE_SETTINGS';
const TOGGLE_SPEAKER_VIEW = 'calling/TOGGLE_SPEAKER_VIEW';
const SWITCH_TO_PRESENTATION_VIEW = 'calling/SWITCH_TO_PRESENTATION_VIEW';
const SWITCH_FROM_PRESENTATION_VIEW = 'calling/SWITCH_FROM_PRESENTATION_VIEW';

type AcceptCallPendingActionType = {
  type: 'calling/ACCEPT_CALL_PENDING';
  payload: AcceptCallType;
};

type CancelCallActionType = {
  type: 'calling/CANCEL_CALL';
};

type CancelIncomingGroupCallRingActionType = {
  type: 'calling/CANCEL_INCOMING_GROUP_CALL_RING';
  payload: CancelIncomingGroupCallRingType;
};

type StartCallingLobbyActionType = {
  type: 'calling/START_CALLING_LOBBY';
  payload: StartCallingLobbyPayloadType;
};

type CallStateChangeFulfilledActionType = {
  type: 'calling/CALL_STATE_CHANGE_FULFILLED';
  payload: CallStateChangeType;
};

type ChangeIODeviceFulfilledActionType = {
  type: 'calling/CHANGE_IO_DEVICE_FULFILLED';
  payload: ChangeIODevicePayloadType;
};

type CloseNeedPermissionScreenActionType = {
  type: 'calling/CLOSE_NEED_PERMISSION_SCREEN';
  payload: null;
};

type DeclineCallActionType = {
  type: 'calling/DECLINE_DIRECT_CALL';
  payload: DeclineCallType;
};

type GroupCallAudioLevelsChangeActionPayloadType = Readonly<{
  conversationId: string;
  localAudioLevel: number;
  remoteDeviceStates: ReadonlyArray<{ audioLevel: number; demuxId: number }>;
}>;

type GroupCallAudioLevelsChangeActionType = {
  type: 'calling/GROUP_CALL_AUDIO_LEVELS_CHANGE';
  payload: GroupCallAudioLevelsChangeActionPayloadType;
};

export type GroupCallStateChangeActionType = {
  type: 'calling/GROUP_CALL_STATE_CHANGE';
  payload: GroupCallStateChangeActionPayloadType;
};

type HangUpActionType = {
  type: 'calling/HANG_UP';
  payload: HangUpActionPayloadType;
};

type IncomingDirectCallActionType = {
  type: 'calling/INCOMING_DIRECT_CALL';
  payload: IncomingDirectCallType;
};

type IncomingGroupCallActionType = {
  type: 'calling/INCOMING_GROUP_CALL';
  payload: IncomingGroupCallType;
};

type KeyChangedActionType = {
  type: 'calling/MARK_CALL_UNTRUSTED';
  payload: {
    safetyNumberChangedUuids: Array<UUIDStringType>;
  };
};

type KeyChangeOkActionType = {
  type: 'calling/MARK_CALL_TRUSTED';
  payload: null;
};

type OutgoingCallActionType = {
  type: 'calling/OUTGOING_CALL';
  payload: StartDirectCallType;
};

export type PeekGroupCallFulfilledActionType = {
  type: 'calling/PEEK_GROUP_CALL_FULFILLED';
  payload: {
    conversationId: string;
    peekInfo: GroupCallPeekInfoType;
  };
};

type RefreshIODevicesActionType = {
  type: 'calling/REFRESH_IO_DEVICES';
  payload: MediaDeviceSettings;
};

type RemoteSharingScreenChangeActionType = {
  type: 'calling/REMOTE_SHARING_SCREEN_CHANGE';
  payload: RemoteSharingScreenChangeType;
};

type RemoteVideoChangeActionType = {
  type: 'calling/REMOTE_VIDEO_CHANGE';
  payload: RemoteVideoChangeType;
};

type ReturnToActiveCallActionType = {
  type: 'calling/RETURN_TO_ACTIVE_CALL';
};

type SetLocalAudioActionType = {
  type: 'calling/SET_LOCAL_AUDIO_FULFILLED';
  payload: SetLocalAudioType;
};

type SetLocalVideoFulfilledActionType = {
  type: 'calling/SET_LOCAL_VIDEO_FULFILLED';
  payload: SetLocalVideoType;
};

type SetPresentingFulfilledActionType = {
  type: 'calling/SET_PRESENTING';
  payload?: PresentedSource;
};

type SetPresentingSourcesActionType = {
  type: 'calling/SET_PRESENTING_SOURCES';
  payload: Array<PresentableSource>;
};

type SetOutgoingRingActionType = {
  type: 'calling/SET_OUTGOING_RING';
  payload: boolean;
};

type ShowCallLobbyActionType = {
  type: 'calling/START_CALLING_LOBBY';
  payload: StartCallingLobbyPayloadType;
};

type StartDirectCallActionType = {
  type: 'calling/START_DIRECT_CALL';
  payload: StartDirectCallType;
};

type ToggleNeedsScreenRecordingPermissionsActionType = {
  type: 'calling/TOGGLE_NEEDS_SCREEN_RECORDING_PERMISSIONS';
};

type ToggleParticipantsActionType = {
  type: 'calling/TOGGLE_PARTICIPANTS';
};

type TogglePipActionType = {
  type: 'calling/TOGGLE_PIP';
};

type ToggleSettingsActionType = {
  type: 'calling/TOGGLE_SETTINGS';
};

type ToggleSpeakerViewActionType = {
  type: 'calling/TOGGLE_SPEAKER_VIEW';
};

type SwitchToPresentationViewActionType = {
  type: 'calling/SWITCH_TO_PRESENTATION_VIEW';
};

type SwitchFromPresentationViewActionType = {
  type: 'calling/SWITCH_FROM_PRESENTATION_VIEW';
};

export type CallingActionType =
  | AcceptCallPendingActionType
  | CancelCallActionType
  | CancelIncomingGroupCallRingActionType
  | StartCallingLobbyActionType
  | CallStateChangeFulfilledActionType
  | ChangeIODeviceFulfilledActionType
  | CloseNeedPermissionScreenActionType
  | ConversationChangedActionType
  | ConversationRemovedActionType
  | DeclineCallActionType
  | GroupCallAudioLevelsChangeActionType
  | GroupCallStateChangeActionType
  | HangUpActionType
  | IncomingDirectCallActionType
  | IncomingGroupCallActionType
  | KeyChangedActionType
  | KeyChangeOkActionType
  | OutgoingCallActionType
  | PeekGroupCallFulfilledActionType
  | RefreshIODevicesActionType
  | RemoteSharingScreenChangeActionType
  | RemoteVideoChangeActionType
  | ReturnToActiveCallActionType
  | SetLocalAudioActionType
  | SetLocalVideoFulfilledActionType
  | SetPresentingSourcesActionType
  | SetOutgoingRingActionType
  | ShowCallLobbyActionType
  | StartDirectCallActionType
  | ToggleNeedsScreenRecordingPermissionsActionType
  | ToggleParticipantsActionType
  | TogglePipActionType
  | SetPresentingFulfilledActionType
  | ToggleSettingsActionType
  | ToggleSpeakerViewActionType
  | SwitchToPresentationViewActionType
  | SwitchFromPresentationViewActionType;

// Action Creators

function acceptCall(
  payload: AcceptCallType
): ThunkAction<void, RootStateType, unknown, AcceptCallPendingActionType> {
  return async (dispatch, getState) => {
    const { conversationId, asVideoCall } = payload;

    const call = getOwn(getState().calling.callsByConversation, conversationId);
    if (!call) {
      log.error('Trying to accept a non-existent call');
      return;
    }

    switch (call.callMode) {
      case CallMode.Direct:
        await calling.acceptDirectCall(conversationId, asVideoCall);
        break;
      case CallMode.Group:
        await calling.joinGroupCall(conversationId, true, asVideoCall, false);
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

function callStateChange(
  payload: CallStateChangeType
): ThunkAction<
  void,
  RootStateType,
  unknown,
  CallStateChangeFulfilledActionType
> {
  return async dispatch => {
    const { callState } = payload;
    if (callState === CallState.Ended) {
      await callingTones.playEndCall();
      ipcRenderer.send('close-screen-share-controller');
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
      default:
        throw missingCaseError(call);
    }
  };
}

function getPresentingSources(): ThunkAction<
  void,
  RootStateType,
  unknown,
  | SetPresentingSourcesActionType
  | ToggleNeedsScreenRecordingPermissionsActionType
> {
  return async (dispatch, getState) => {
    // We check if the user has permissions first before calling desktopCapturer
    // Next we call getPresentingSources so that one gets the prompt for permissions,
    // if necessary.
    // Finally, we have the if statement which shows the modal, if needed.
    // It is in this exact order so that during first-time-use one will be
    // prompted for permissions and if they so happen to deny we can still
    // capture that state correctly.
    const platform = getPlatform(getState());
    const needsPermission =
      platform === 'darwin' && !hasScreenCapturePermission();

    const sources = await calling.getPresentingSources();

    if (needsPermission) {
      dispatch({
        type: TOGGLE_NEEDS_SCREEN_RECORDING_PERMISSIONS,
      });
      return;
    }

    dispatch({
      type: SET_PRESENTING_SOURCES,
      payload: sources,
    });
  };
}

function groupCallAudioLevelsChange(
  payload: GroupCallAudioLevelsChangeActionPayloadType
): GroupCallAudioLevelsChangeActionType {
  return { type: GROUP_CALL_AUDIO_LEVELS_CHANGE, payload };
}

function groupCallStateChange(
  payload: GroupCallStateChangeArgumentType
): ThunkAction<void, RootStateType, unknown, GroupCallStateChangeActionType> {
  return async (dispatch, getState) => {
    let didSomeoneStartPresenting: boolean;
    const activeCall = getActiveCall(getState().calling);
    if (activeCall?.callMode === CallMode.Group) {
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

    const { ourACI: ourUuid } = getState().user;
    strictAssert(ourUuid, 'groupCallStateChange failed to fetch our uuid');

    dispatch({
      type: GROUP_CALL_STATE_CHANGE,
      payload: {
        ...payload,
        ourUuid,
      },
    });

    if (didSomeoneStartPresenting) {
      callingTones.someonePresenting();
    }

    if (payload.connectionState === GroupCallConnectionState.NotConnected) {
      ipcRenderer.send('close-screen-share-controller');
    }
  };
}

function hangUpActiveCall(): ThunkAction<
  void,
  RootStateType,
  unknown,
  HangUpActionType
> {
  return async (dispatch, getState) => {
    const state = getState();

    const activeCall = getActiveCall(state.calling);
    if (!activeCall) {
      return;
    }

    const { conversationId } = activeCall;

    calling.hangup(conversationId);

    dispatch({
      type: HANG_UP,
      payload: {
        conversationId,
      },
    });

    if (activeCall.callMode === CallMode.Group) {
      // We want to give the group call time to disconnect.
      await sleep(1000);
      doGroupCallPeek(conversationId, dispatch, getState);
    }
  };
}

function keyChanged(
  payload: KeyChangedType
): ThunkAction<void, RootStateType, unknown, KeyChangedActionType> {
  return (dispatch, getState) => {
    const state = getState();
    const { activeCallState } = state.calling;

    const activeCall = getActiveCall(state.calling);
    if (!activeCall || !activeCallState) {
      return;
    }

    if (activeCall.callMode === CallMode.Group) {
      const uuidsChanged = new Set(activeCallState.safetyNumberChangedUuids);

      // Iterate over each participant to ensure that the uuid passed in
      // matches one of the participants in the group call.
      activeCall.remoteParticipants.forEach(participant => {
        if (participant.uuid === payload.uuid) {
          uuidsChanged.add(participant.uuid);
        }
      });

      const safetyNumberChangedUuids = Array.from(uuidsChanged);

      if (safetyNumberChangedUuids.length) {
        dispatch({
          type: MARK_CALL_UNTRUSTED,
          payload: {
            safetyNumberChangedUuids,
          },
        });
      }
    }
  };
}

function keyChangeOk(
  payload: KeyChangeOkType
): ThunkAction<void, RootStateType, unknown, KeyChangeOkActionType> {
  return dispatch => {
    calling.resendGroupCallMediaKeys(payload.conversationId);

    dispatch({
      type: MARK_CALL_TRUSTED,
      payload: null,
    });
  };
}

function receiveIncomingDirectCall(
  payload: IncomingDirectCallType
): IncomingDirectCallActionType {
  return {
    type: INCOMING_DIRECT_CALL,
    payload,
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
    openSystemPreferences();
  };
}

function outgoingCall(payload: StartDirectCallType): OutgoingCallActionType {
  return {
    type: OUTGOING_CALL,
    payload,
  };
}

function peekGroupCallForTheFirstTime(
  conversationId: string
): ThunkAction<void, RootStateType, unknown, PeekGroupCallFulfilledActionType> {
  return (dispatch, getState) => {
    const call = getOwn(getState().calling.callsByConversation, conversationId);
    const shouldPeek =
      !call || (call.callMode === CallMode.Group && !call.peekInfo);
    if (shouldPeek) {
      doGroupCallPeek(conversationId, dispatch, getState);
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
      call.callMode === CallMode.Group &&
      call.joinState === GroupCallJoinState.NotJoined &&
      call.peekInfo &&
      call.peekInfo.deviceCount > 0;
    if (shouldPeek) {
      doGroupCallPeek(conversationId, dispatch, getState);
    }
  };
}

function peekNotConnectedGroupCall(
  payload: PeekNotConnectedGroupCallType
): ThunkAction<void, RootStateType, unknown, PeekGroupCallFulfilledActionType> {
  return (dispatch, getState) => {
    const { conversationId } = payload;
    doGroupCallPeek(conversationId, dispatch, getState);
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

function setIsCallActive(
  isCallActive: boolean
): ThunkAction<void, RootStateType, unknown, never> {
  return () => {
    window.SignalContext.setIsCallActive(isCallActive);
  };
}

function setLocalPreview(
  payload: SetLocalPreviewType
): ThunkAction<void, RootStateType, unknown, never> {
  return () => {
    calling.videoCapturer.setLocalPreview(payload.element);
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
        activeCall.callMode === CallMode.Group ||
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
      }))
    );
  };
}

function setPresenting(
  sourceToPresent?: PresentedSource
): ThunkAction<void, RootStateType, unknown, SetPresentingFulfilledActionType> {
  return async (dispatch, getState) => {
    const callingState = getState().calling;
    const { activeCallState } = callingState;
    const activeCall = getActiveCall(callingState);
    if (!activeCall || !activeCallState) {
      log.warn('Trying to present when no call is active');
      return;
    }

    calling.setPresenting(
      activeCall.conversationId,
      activeCallState.hasLocalVideo,
      sourceToPresent
    );

    dispatch({
      type: SET_PRESENTING,
      payload: sourceToPresent,
    });

    if (sourceToPresent) {
      await callingTones.someonePresenting();
    }
  };
}

function setOutgoingRing(payload: boolean): SetOutgoingRingActionType {
  return {
    type: SET_OUTGOING_RING,
    payload,
  };
}

function startCallingLobby({
  conversationId,
  isVideoCall,
}: StartCallingLobbyType): ThunkAction<
  void,
  RootStateType,
  unknown,
  StartCallingLobbyActionType
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

    strictAssert(
      !state.calling.activeCallState,
      "startCallingLobby: can't start lobby if a call is active"
    );

    // The group call device count is considered 0 for a direct call.
    const groupCall = getGroupCall(conversationId, state.calling);
    const groupCallDeviceCount =
      groupCall?.peekInfo?.deviceCount ||
      groupCall?.remoteParticipants.length ||
      0;

    const callLobbyData = await calling.startCallingLobby({
      conversation,
      hasLocalAudio: groupCallDeviceCount < 8,
      hasLocalVideo: isVideoCall,
    });
    if (!callLobbyData) {
      return;
    }

    dispatch({
      type: START_CALLING_LOBBY,
      payload: {
        ...callLobbyData,
        conversationId,
        isConversationTooBigToRing: isConversationTooBigToRing(conversation),
      },
    });
  };
}

function startCall(
  payload: StartCallType
): ThunkAction<void, RootStateType, unknown, StartDirectCallActionType> {
  return async (dispatch, getState) => {
    switch (payload.callMode) {
      case CallMode.Direct:
        await calling.startOutgoingDirectCall(
          payload.conversationId,
          payload.hasLocalAudio,
          payload.hasLocalVideo
        );
        dispatch({
          type: START_DIRECT_CALL,
          payload,
        });
        break;
      case CallMode.Group: {
        let outgoingRing: boolean;

        const state = getState();
        const { activeCallState } = state.calling;
        if (isGroupCallOutboundRingEnabled() && activeCallState?.outgoingRing) {
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
          payload.conversationId,
          payload.hasLocalAudio,
          payload.hasLocalVideo,
          outgoingRing
        );
        // The calling service should already be wired up to Redux so we don't need to
        //   dispatch anything here.
        break;
      }
      default:
        throw missingCaseError(payload.callMode);
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

function toggleSpeakerView(): ToggleSpeakerViewActionType {
  return {
    type: TOGGLE_SPEAKER_VIEW,
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
  callStateChange,
  cancelCall,
  cancelIncomingGroupCallRing,
  changeIODevice,
  closeNeedPermissionScreen,
  declineCall,
  getPresentingSources,
  groupCallAudioLevelsChange,
  groupCallStateChange,
  hangUpActiveCall,
  keyChangeOk,
  keyChanged,
  openSystemPreferencesAction,
  outgoingCall,
  peekGroupCallForTheFirstTime,
  peekGroupCallIfItHasMembers,
  peekNotConnectedGroupCall,
  receiveIncomingDirectCall,
  receiveIncomingGroupCall,
  refreshIODevices,
  remoteSharingScreenChange,
  remoteVideoChange,
  returnToActiveCall,
  setGroupCallVideoRequest,
  setIsCallActive,
  setLocalAudio,
  setLocalPreview,
  setLocalVideo,
  setPresenting,
  setRendererCanvas,
  setOutgoingRing,
  startCall,
  startCallingLobby,
  switchToPresentationView,
  switchFromPresentationView,
  toggleParticipants,
  togglePip,
  toggleScreenRecordingPermissionsDialog,
  toggleSettings,
  toggleSpeakerView,
};

export type ActionsType = typeof actions;

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
    activeCallState: undefined,
  };
}

function getGroupCall(
  conversationId: string,
  state: Readonly<CallingStateType>
): undefined | GroupCallStateType {
  const call = getOwn(state.callsByConversation, conversationId);
  return call?.callMode === CallMode.Group ? call : undefined;
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
  };
}

export function reducer(
  state: Readonly<CallingStateType> = getEmptyState(),
  action: Readonly<CallingActionType>
): CallingStateType {
  const { callsByConversation } = state;

  if (action.type === START_CALLING_LOBBY) {
    const { conversationId } = action.payload;

    let call: DirectCallStateType | GroupCallStateType;
    let outgoingRing: boolean;
    switch (action.payload.callMode) {
      case CallMode.Direct:
        call = {
          callMode: CallMode.Direct,
          conversationId,
          isIncoming: false,
          isVideoCall: action.payload.hasLocalVideo,
        };
        outgoingRing = true;
        break;
      case CallMode.Group: {
        // We expect to be in this state briefly. The Calling service should update the
        //   call state shortly.
        const existingCall = getGroupCall(conversationId, state);
        const ringState = getGroupCallRingState(existingCall);
        call = {
          callMode: CallMode.Group,
          conversationId,
          connectionState: action.payload.connectionState,
          joinState: action.payload.joinState,
          peekInfo: action.payload.peekInfo ||
            existingCall?.peekInfo || {
              uuids: action.payload.remoteParticipants.map(({ uuid }) => uuid),
              maxDevices: Infinity,
              deviceCount: action.payload.remoteParticipants.length,
            },
          remoteParticipants: action.payload.remoteParticipants,
          ...ringState,
        };
        outgoingRing =
          isGroupCallOutboundRingEnabled() &&
          !ringState.ringId &&
          !call.peekInfo?.uuids.length &&
          !call.remoteParticipants.length &&
          !action.payload.isConversationTooBigToRing;
        break;
      }
      default:
        throw missingCaseError(action.payload);
    }

    return {
      ...state,
      callsByConversation: {
        ...callsByConversation,
        [action.payload.conversationId]: call,
      },
      activeCallState: {
        conversationId: action.payload.conversationId,
        hasLocalAudio: action.payload.hasLocalAudio,
        hasLocalVideo: action.payload.hasLocalVideo,
        localAudioLevel: 0,
        viewMode: CallViewMode.Grid,
        pip: false,
        safetyNumberChangedUuids: [],
        settingsDialogOpen: false,
        showParticipantsList: false,
        outgoingRing,
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
        conversationId: action.payload.conversationId,
        hasLocalAudio: action.payload.hasLocalAudio,
        hasLocalVideo: action.payload.hasLocalVideo,
        localAudioLevel: 0,
        viewMode: CallViewMode.Grid,
        pip: false,
        safetyNumberChangedUuids: [],
        settingsDialogOpen: false,
        showParticipantsList: false,
        outgoingRing: true,
      },
    };
  }

  if (action.type === ACCEPT_CALL_PENDING) {
    if (!has(state.callsByConversation, action.payload.conversationId)) {
      log.warn('Unable to accept a non-existent call');
      return state;
    }

    return {
      ...state,
      activeCallState: {
        conversationId: action.payload.conversationId,
        hasLocalAudio: true,
        hasLocalVideo: action.payload.asVideoCall,
        localAudioLevel: 0,
        viewMode: CallViewMode.Grid,
        pip: false,
        safetyNumberChangedUuids: [],
        settingsDialogOpen: false,
        showParticipantsList: false,
        outgoingRing: false,
      },
    };
  }

  if (
    action.type === CANCEL_CALL ||
    action.type === HANG_UP ||
    action.type === CLOSE_NEED_PERMISSION_SCREEN
  ) {
    const activeCall = getActiveCall(state);
    if (!activeCall) {
      log.warn('No active call to remove');
      return state;
    }
    switch (activeCall.callMode) {
      case CallMode.Direct:
        return removeConversationFromState(state, activeCall.conversationId);
      case CallMode.Group:
        return omit(state, 'activeCallState');
      default:
        throw missingCaseError(activeCall);
    }
  }

  if (action.type === CANCEL_INCOMING_GROUP_CALL_RING) {
    const { conversationId, ringId } = action.payload;

    const groupCall = getGroupCall(conversationId, state);
    if (!groupCall || groupCall.ringId !== ringId) {
      return state;
    }

    return {
      ...state,
      callsByConversation: {
        ...callsByConversation,
        [conversationId]: omit(groupCall, ['ringId', 'ringerUuid']),
      },
    };
  }

  if (action.type === 'CONVERSATION_CHANGED') {
    const activeCall = getActiveCall(state);
    const { activeCallState } = state;
    if (
      !activeCallState?.outgoingRing ||
      activeCallState.conversationId !== action.payload.id ||
      activeCall?.callMode !== CallMode.Group ||
      activeCall.joinState !== GroupCallJoinState.NotJoined ||
      !isConversationTooBigToRing(action.payload.data)
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
    const { conversationId, ringId, ringerUuid } = action.payload;

    let groupCall: GroupCallStateType;
    const existingGroupCall = getGroupCall(conversationId, state);
    if (existingGroupCall) {
      if (existingGroupCall.ringerUuid) {
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
        ringerUuid,
      };
    } else {
      groupCall = {
        callMode: CallMode.Group,
        conversationId,
        connectionState: GroupCallConnectionState.NotConnected,
        joinState: GroupCallJoinState.NotJoined,
        peekInfo: {
          uuids: [],
          maxDevices: Infinity,
          deviceCount: 0,
        },
        remoteParticipants: [],
        ringId,
        ringerUuid,
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
        conversationId: action.payload.conversationId,
        hasLocalAudio: action.payload.hasLocalAudio,
        hasLocalVideo: action.payload.hasLocalVideo,
        localAudioLevel: 0,
        viewMode: CallViewMode.Grid,
        pip: false,
        safetyNumberChangedUuids: [],
        settingsDialogOpen: false,
        showParticipantsList: false,
        outgoingRing: true,
      },
    };
  }

  if (action.type === CALL_STATE_CHANGE_FULFILLED) {
    // We want to keep the state around for ended calls if they resulted in a message
    //   request so we can show the "needs permission" screen.
    if (
      action.payload.callState === CallState.Ended &&
      action.payload.callEndedReason !==
        CallEndedReason.RemoteHangupNeedPermission
    ) {
      return removeConversationFromState(state, action.payload.conversationId);
    }

    const call = getOwn(
      state.callsByConversation,
      action.payload.conversationId
    );
    if (call?.callMode !== CallMode.Direct) {
      log.warn('Cannot update state for a non-direct call');
      return state;
    }

    let activeCallState: undefined | ActiveCallStateType;
    if (
      state.activeCallState?.conversationId === action.payload.conversationId
    ) {
      activeCallState = {
        ...state.activeCallState,
        joinedAt: action.payload.acceptedTime,
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
    const { conversationId, remoteDeviceStates } = action.payload;

    const { activeCallState } = state;
    const existingCall = getGroupCall(conversationId, state);

    // The PiP check is an optimization. We don't need to update audio levels if the user
    //   cannot see them.
    if (!activeCallState || activeCallState.pip || !existingCall) {
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
      callsByConversation: {
        ...callsByConversation,
        [conversationId]: { ...existingCall, remoteAudioLevels },
      },
    };
  }

  if (action.type === GROUP_CALL_STATE_CHANGE) {
    const {
      connectionState,
      conversationId,
      hasLocalAudio,
      hasLocalVideo,
      joinState,
      ourUuid,
      peekInfo,
      remoteParticipants,
    } = action.payload;

    const existingCall = getGroupCall(conversationId, state);
    const existingRingState = getGroupCallRingState(existingCall);

    const newPeekInfo = peekInfo ||
      existingCall?.peekInfo || {
        uuids: remoteParticipants.map(({ uuid }) => uuid),
        maxDevices: Infinity,
        deviceCount: remoteParticipants.length,
      };

    let newActiveCallState: ActiveCallStateType | undefined;
    if (state.activeCallState?.conversationId === conversationId) {
      newActiveCallState =
        connectionState === GroupCallConnectionState.NotConnected
          ? undefined
          : {
              ...state.activeCallState,
              hasLocalAudio,
              hasLocalVideo,
            };
    } else {
      newActiveCallState = state.activeCallState;
    }

    if (
      newActiveCallState &&
      newActiveCallState.outgoingRing &&
      newActiveCallState.conversationId === conversationId &&
      isAnybodyElseInGroupCall(newPeekInfo, ourUuid)
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

    return {
      ...state,
      callsByConversation: {
        ...callsByConversation,
        [conversationId]: {
          callMode: CallMode.Group,
          conversationId,
          connectionState,
          joinState,
          peekInfo: newPeekInfo,
          remoteParticipants,
          ...newRingState,
        },
      },
      activeCallState: newActiveCallState,
    };
  }

  if (action.type === PEEK_GROUP_CALL_FULFILLED) {
    const { conversationId, peekInfo } = action.payload;

    const existingCall: GroupCallStateType = getGroupCall(
      conversationId,
      state
    ) || {
      callMode: CallMode.Group,
      conversationId,
      connectionState: GroupCallConnectionState.NotConnected,
      joinState: GroupCallJoinState.NotJoined,
      peekInfo: {
        uuids: [],
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
      callsByConversation: {
        ...callsByConversation,
        [conversationId]: {
          ...existingCall,
          peekInfo,
        },
      },
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
    if (!activeCallState) {
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
    if (!state.activeCallState) {
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
    if (!state.activeCallState) {
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
    if (!activeCallState) {
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
    if (!activeCallState) {
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
    if (!activeCallState) {
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
    if (!activeCallState) {
      log.warn('Cannot toggle presenting when there is no active call');
      return state;
    }

    return {
      ...state,
      activeCallState: {
        ...activeCallState,
        presentingSource: action.payload,
        presentingSourcesAvailable: undefined,
      },
    };
  }

  if (action.type === SET_PRESENTING_SOURCES) {
    const { activeCallState } = state;
    if (!activeCallState) {
      log.warn('Cannot set presenting sources when there is no active call');
      return state;
    }

    return {
      ...state,
      activeCallState: {
        ...activeCallState,
        presentingSourcesAvailable: action.payload,
      },
    };
  }

  if (action.type === SET_OUTGOING_RING) {
    const { activeCallState } = state;
    if (!activeCallState) {
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
    if (!activeCallState) {
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

  if (action.type === TOGGLE_SPEAKER_VIEW) {
    const { activeCallState } = state;
    if (!activeCallState) {
      log.warn('Cannot toggle speaker view when there is no active call');
      return state;
    }

    let newViewMode: CallViewMode;
    if (activeCallState.viewMode === CallViewMode.Grid) {
      newViewMode = CallViewMode.Speaker;
    } else {
      // This will switch presentation/speaker to grid
      newViewMode = CallViewMode.Grid;
    }

    return {
      ...state,
      activeCallState: {
        ...activeCallState,
        viewMode: newViewMode,
      },
    };
  }

  if (action.type === SWITCH_TO_PRESENTATION_VIEW) {
    const { activeCallState } = state;
    if (!activeCallState) {
      log.warn('Cannot switch to speaker view when there is no active call');
      return state;
    }

    // "Presentation" mode reverts to "Grid" when the call is over so don't
    // switch it if it is in "Speaker" mode.
    if (activeCallState.viewMode === CallViewMode.Speaker) {
      return state;
    }

    return {
      ...state,
      activeCallState: {
        ...activeCallState,
        viewMode: CallViewMode.Presentation,
      },
    };
  }

  if (action.type === SWITCH_FROM_PRESENTATION_VIEW) {
    const { activeCallState } = state;
    if (!activeCallState) {
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
        viewMode: CallViewMode.Grid,
      },
    };
  }

  if (action.type === MARK_CALL_UNTRUSTED) {
    const { activeCallState } = state;
    if (!activeCallState) {
      log.warn('Cannot mark call as untrusted when there is no active call');
      return state;
    }

    const { safetyNumberChangedUuids } = action.payload;

    return {
      ...state,
      activeCallState: {
        ...activeCallState,
        pip: false,
        safetyNumberChangedUuids,
        settingsDialogOpen: false,
        showParticipantsList: false,
      },
    };
  }

  if (action.type === MARK_CALL_TRUSTED) {
    const { activeCallState } = state;
    if (!activeCallState) {
      log.warn('Cannot mark call as trusted when there is no active call');
      return state;
    }

    return {
      ...state,
      activeCallState: {
        ...activeCallState,
        safetyNumberChangedUuids: [],
      },
    };
  }

  return state;
}
