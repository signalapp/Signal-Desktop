// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ThunkAction } from 'redux-thunk';
import { CallEndedReason } from 'ringrtc';
import { has, omit } from 'lodash';
import { getOwn } from '../../util/getOwn';
import { missingCaseError } from '../../util/missingCaseError';
import { notify } from '../../services/notify';
import { calling } from '../../services/calling';
import { StateType as RootStateType } from '../reducer';
import { ConversationType } from './conversations';
import {
  CallMode,
  CallState,
  CallingDeviceType,
  ChangeIODevicePayloadType,
  GroupCallConnectionState,
  GroupCallJoinState,
  GroupCallPeekedParticipantType,
  GroupCallRemoteParticipantType,
  MediaDeviceSettings,
} from '../../types/Calling';
import { callingTones } from '../../util/callingTones';
import { requestCameraPermissions } from '../../util/callingPermissions';
import {
  bounceAppIconStart,
  bounceAppIconStop,
} from '../../shims/bounceAppIcon';
import { sleep } from '../../util/sleep';
import { LatestQueue } from '../../util/LatestQueue';

// State

export interface GroupCallPeekInfoType {
  conversationIds: Array<string>;
  creator?: string;
  eraId?: string;
  maxDevices: number;
  deviceCount: number;
}

export interface GroupCallParticipantInfoType {
  conversationId: string;
  demuxId: number;
  hasRemoteAudio: boolean;
  hasRemoteVideo: boolean;
  isSelf: boolean;
  videoAspectRatio: number;
}

export interface DirectCallStateType {
  callMode: CallMode.Direct;
  conversationId: string;
  callState?: CallState;
  callEndedReason?: CallEndedReason;
  isIncoming: boolean;
  isVideoCall: boolean;
  hasRemoteVideo?: boolean;
}

export interface GroupCallStateType {
  callMode: CallMode.Group;
  conversationId: string;
  connectionState: GroupCallConnectionState;
  joinState: GroupCallJoinState;
  peekInfo: GroupCallPeekInfoType;
  remoteParticipants: Array<GroupCallParticipantInfoType>;
}

export interface ActiveCallType {
  activeCallState: ActiveCallStateType;
  call: DirectCallStateType | GroupCallStateType;
  conversation: ConversationType;
  isCallFull: boolean;
  groupCallPeekedParticipants: Array<GroupCallPeekedParticipantType>;
  groupCallParticipants: Array<GroupCallRemoteParticipantType>;
}

export interface ActiveCallStateType {
  conversationId: string;
  joinedAt?: number;
  hasLocalAudio: boolean;
  hasLocalVideo: boolean;
  showParticipantsList: boolean;
  pip: boolean;
  settingsDialogOpen: boolean;
}

export type CallingStateType = MediaDeviceSettings & {
  callsByConversation: {
    [conversationId: string]: DirectCallStateType | GroupCallStateType;
  };
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

export type DeclineCallType = {
  conversationId: string;
};

type GroupCallStateChangeArgumentType = {
  connectionState: GroupCallConnectionState;
  conversationId: string;
  hasLocalAudio: boolean;
  hasLocalVideo: boolean;
  joinState: GroupCallJoinState;
  peekInfo: GroupCallPeekInfoType;
  remoteParticipants: Array<GroupCallParticipantInfoType>;
};

type GroupCallStateChangeActionPayloadType = GroupCallStateChangeArgumentType & {
  ourConversationId: string;
};

export type HangUpType = {
  conversationId: string;
};

export type IncomingCallType = {
  conversationId: string;
  isVideoCall: boolean;
};

type PeekNotConnectedGroupCallType = {
  conversationId: string;
};

interface StartDirectCallType {
  conversationId: string;
  hasLocalAudio: boolean;
  hasLocalVideo: boolean;
}

export interface StartCallType extends StartDirectCallType {
  callMode: CallMode.Direct | CallMode.Group;
}

export type RemoteVideoChangeType = {
  conversationId: string;
  hasVideo: boolean;
};

export type SetLocalAudioType = {
  enabled: boolean;
};

export type SetLocalVideoType = {
  enabled: boolean;
};

export type ShowCallLobbyType =
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
      peekInfo: GroupCallPeekInfoType;
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

export const isAnybodyElseInGroupCall = (
  { conversationIds }: Readonly<GroupCallPeekInfoType>,
  ourConversationId: string
): boolean => conversationIds.some(id => id !== ourConversationId);

// Actions

const ACCEPT_CALL_PENDING = 'calling/ACCEPT_CALL_PENDING';
const CANCEL_CALL = 'calling/CANCEL_CALL';
const SHOW_CALL_LOBBY = 'calling/SHOW_CALL_LOBBY';
const CALL_STATE_CHANGE_FULFILLED = 'calling/CALL_STATE_CHANGE_FULFILLED';
const CHANGE_IO_DEVICE_FULFILLED = 'calling/CHANGE_IO_DEVICE_FULFILLED';
const CLOSE_NEED_PERMISSION_SCREEN = 'calling/CLOSE_NEED_PERMISSION_SCREEN';
const DECLINE_CALL = 'calling/DECLINE_CALL';
const GROUP_CALL_STATE_CHANGE = 'calling/GROUP_CALL_STATE_CHANGE';
const HANG_UP = 'calling/HANG_UP';
const INCOMING_CALL = 'calling/INCOMING_CALL';
const OUTGOING_CALL = 'calling/OUTGOING_CALL';
const PEEK_NOT_CONNECTED_GROUP_CALL_FULFILLED =
  'calling/PEEK_NOT_CONNECTED_GROUP_CALL_FULFILLED';
const REFRESH_IO_DEVICES = 'calling/REFRESH_IO_DEVICES';
const REMOTE_VIDEO_CHANGE = 'calling/REMOTE_VIDEO_CHANGE';
const SET_LOCAL_AUDIO_FULFILLED = 'calling/SET_LOCAL_AUDIO_FULFILLED';
const SET_LOCAL_VIDEO_FULFILLED = 'calling/SET_LOCAL_VIDEO_FULFILLED';
const START_DIRECT_CALL = 'calling/START_DIRECT_CALL';
const TOGGLE_PARTICIPANTS = 'calling/TOGGLE_PARTICIPANTS';
const TOGGLE_PIP = 'calling/TOGGLE_PIP';
const TOGGLE_SETTINGS = 'calling/TOGGLE_SETTINGS';

type AcceptCallPendingActionType = {
  type: 'calling/ACCEPT_CALL_PENDING';
  payload: AcceptCallType;
};

type CancelCallActionType = {
  type: 'calling/CANCEL_CALL';
};

type CallLobbyActionType = {
  type: 'calling/SHOW_CALL_LOBBY';
  payload: ShowCallLobbyType;
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
  type: 'calling/DECLINE_CALL';
  payload: DeclineCallType;
};

export type GroupCallStateChangeActionType = {
  type: 'calling/GROUP_CALL_STATE_CHANGE';
  payload: GroupCallStateChangeActionPayloadType;
};

type HangUpActionType = {
  type: 'calling/HANG_UP';
  payload: HangUpType;
};

type IncomingCallActionType = {
  type: 'calling/INCOMING_CALL';
  payload: IncomingCallType;
};

type OutgoingCallActionType = {
  type: 'calling/OUTGOING_CALL';
  payload: StartDirectCallType;
};

type PeekNotConnectedGroupCallFulfilledActionType = {
  type: 'calling/PEEK_NOT_CONNECTED_GROUP_CALL_FULFILLED';
  payload: {
    conversationId: string;
    peekInfo: GroupCallPeekInfoType;
    ourConversationId: string;
  };
};

type RefreshIODevicesActionType = {
  type: 'calling/REFRESH_IO_DEVICES';
  payload: MediaDeviceSettings;
};

type RemoteVideoChangeActionType = {
  type: 'calling/REMOTE_VIDEO_CHANGE';
  payload: RemoteVideoChangeType;
};

type SetLocalAudioActionType = {
  type: 'calling/SET_LOCAL_AUDIO_FULFILLED';
  payload: SetLocalAudioType;
};

type SetLocalVideoFulfilledActionType = {
  type: 'calling/SET_LOCAL_VIDEO_FULFILLED';
  payload: SetLocalVideoType;
};

type ShowCallLobbyActionType = {
  type: 'calling/SHOW_CALL_LOBBY';
  payload: ShowCallLobbyType;
};

type StartDirectCallActionType = {
  type: 'calling/START_DIRECT_CALL';
  payload: StartDirectCallType;
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

export type CallingActionType =
  | AcceptCallPendingActionType
  | CancelCallActionType
  | CallLobbyActionType
  | CallStateChangeFulfilledActionType
  | ChangeIODeviceFulfilledActionType
  | CloseNeedPermissionScreenActionType
  | DeclineCallActionType
  | GroupCallStateChangeActionType
  | HangUpActionType
  | IncomingCallActionType
  | OutgoingCallActionType
  | PeekNotConnectedGroupCallFulfilledActionType
  | RefreshIODevicesActionType
  | RemoteVideoChangeActionType
  | SetLocalAudioActionType
  | SetLocalVideoFulfilledActionType
  | ShowCallLobbyActionType
  | StartDirectCallActionType
  | ToggleParticipantsActionType
  | TogglePipActionType
  | ToggleSettingsActionType;

// Action Creators

function acceptCall(
  payload: AcceptCallType
): ThunkAction<void, RootStateType, unknown, AcceptCallPendingActionType> {
  return async dispatch => {
    dispatch({
      type: ACCEPT_CALL_PENDING,
      payload,
    });

    try {
      await calling.accept(payload.conversationId, payload.asVideoCall);
    } catch (err) {
      window.log.error(`Failed to acceptCall: ${err.stack}`);
    }
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
    const { callState, isIncoming, title, isVideoCall } = payload;
    if (callState === CallState.Ringing && isIncoming) {
      await callingTones.playRingtone();
      await showCallNotification(title, isVideoCall);
      bounceAppIconStart();
    }
    if (callState !== CallState.Ringing) {
      await callingTones.stopRingtone();
      bounceAppIconStop();
    }
    if (callState === CallState.Ended) {
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

async function showCallNotification(
  title: string,
  isVideoCall: boolean
): Promise<void> {
  const canNotify = await window.getCallSystemNotification();
  if (!canNotify) {
    return;
  }
  notify({
    title,
    icon: isVideoCall
      ? 'images/icons/v2/video-solid-24.svg'
      : 'images/icons/v2/phone-right-solid-24.svg',
    message: window.i18n(
      isVideoCall ? 'incomingVideoCall' : 'incomingAudioCall'
    ),
    onNotificationClick: () => {
      window.showWindow();
    },
    silent: false,
  });
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

function declineCall(payload: DeclineCallType): DeclineCallActionType {
  calling.decline(payload.conversationId);

  return {
    type: DECLINE_CALL,
    payload,
  };
}

function groupCallStateChange(
  payload: GroupCallStateChangeArgumentType
): ThunkAction<void, RootStateType, unknown, GroupCallStateChangeActionType> {
  return (dispatch, getState) => {
    dispatch({
      type: GROUP_CALL_STATE_CHANGE,
      payload: {
        ...payload,
        ourConversationId: getState().user.ourConversationId,
      },
    });
  };
}

function hangUp(payload: HangUpType): HangUpActionType {
  calling.hangup(payload.conversationId);

  return {
    type: HANG_UP,
    payload,
  };
}

function receiveIncomingCall(
  payload: IncomingCallType
): IncomingCallActionType {
  return {
    type: INCOMING_CALL,
    payload,
  };
}

function outgoingCall(payload: StartDirectCallType): OutgoingCallActionType {
  callingTones.playRingtone();

  return {
    type: OUTGOING_CALL,
    payload,
  };
}

// We might call this function many times in rapid succession (for example, if lots of
//   people are joining and leaving at once). We want to make sure to update eventually
//   (if people join and leave for an hour, we don't want you to have to wait an hour to
//   get an update), and we also don't want to update too often. That's why we use a
//   "latest queue".
const peekQueueByConversation = new Map<string, LatestQueue>();
function peekNotConnectedGroupCall(
  payload: PeekNotConnectedGroupCallType
): ThunkAction<
  void,
  RootStateType,
  unknown,
  PeekNotConnectedGroupCallFulfilledActionType
> {
  return (dispatch, getState) => {
    const { conversationId } = payload;

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
      await sleep(1000);

      let peekInfo;
      try {
        peekInfo = await calling.peekGroupCall(conversationId);
      } catch (err) {
        window.log.error('Group call peeking failed', err);
        return;
      }

      if (!peekInfo) {
        return;
      }

      dispatch({
        type: PEEK_NOT_CONNECTED_GROUP_CALL_FULFILLED,
        payload: {
          conversationId,
          peekInfo: calling.formatGroupCallPeekInfoForRedux(peekInfo),
          ourConversationId: state.user.ourConversationId,
        },
      });
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

function remoteVideoChange(
  payload: RemoteVideoChangeType
): RemoteVideoChangeActionType {
  return {
    type: REMOTE_VIDEO_CHANGE,
    payload,
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
      window.log.warn('Trying to set local audio when no call is active');
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
      window.log.warn('Trying to set local video when no call is active');
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
        calling.disableLocalCamera();
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

function showCallLobby(payload: ShowCallLobbyType): CallLobbyActionType {
  return {
    type: SHOW_CALL_LOBBY,
    payload,
  };
}

function startCall(
  payload: StartCallType
): ThunkAction<void, RootStateType, unknown, StartDirectCallActionType> {
  return dispatch => {
    switch (payload.callMode) {
      case CallMode.Direct:
        calling.startOutgoingDirectCall(
          payload.conversationId,
          payload.hasLocalAudio,
          payload.hasLocalVideo
        );
        dispatch({
          type: START_DIRECT_CALL,
          payload,
        });
        break;
      case CallMode.Group:
        calling.joinGroupCall(
          payload.conversationId,
          payload.hasLocalAudio,
          payload.hasLocalVideo
        );
        // The calling service should already be wired up to Redux so we don't need to
        //   dispatch anything here.
        break;
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

function toggleSettings(): ToggleSettingsActionType {
  return {
    type: TOGGLE_SETTINGS,
  };
}

export const actions = {
  acceptCall,
  cancelCall,
  callStateChange,
  changeIODevice,
  closeNeedPermissionScreen,
  declineCall,
  groupCallStateChange,
  hangUp,
  receiveIncomingCall,
  outgoingCall,
  peekNotConnectedGroupCall,
  refreshIODevices,
  remoteVideoChange,
  setLocalPreview,
  setRendererCanvas,
  setLocalAudio,
  setLocalVideo,
  showCallLobby,
  startCall,
  toggleParticipants,
  togglePip,
  toggleSettings,
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

function removeConversationFromState(
  state: CallingStateType,
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
  state: CallingStateType = getEmptyState(),
  action: CallingActionType
): CallingStateType {
  const { callsByConversation } = state;

  if (action.type === SHOW_CALL_LOBBY) {
    let call: DirectCallStateType | GroupCallStateType;
    switch (action.payload.callMode) {
      case CallMode.Direct:
        call = {
          callMode: CallMode.Direct,
          conversationId: action.payload.conversationId,
          isIncoming: false,
          isVideoCall: action.payload.hasLocalVideo,
        };
        break;
      case CallMode.Group:
        // We expect to be in this state briefly. The Calling service should update the
        //   call state shortly.
        call = {
          callMode: CallMode.Group,
          conversationId: action.payload.conversationId,
          connectionState: action.payload.connectionState,
          joinState: action.payload.joinState,
          peekInfo: action.payload.peekInfo,
          remoteParticipants: action.payload.remoteParticipants,
        };
        break;
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
        showParticipantsList: false,
        pip: false,
        settingsDialogOpen: false,
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
        showParticipantsList: false,
        pip: false,
        settingsDialogOpen: false,
      },
    };
  }

  if (action.type === ACCEPT_CALL_PENDING) {
    if (!has(state.callsByConversation, action.payload.conversationId)) {
      window.log.warn('Unable to accept a non-existent call');
      return state;
    }

    return {
      ...state,
      activeCallState: {
        conversationId: action.payload.conversationId,
        hasLocalAudio: true,
        hasLocalVideo: action.payload.asVideoCall,
        showParticipantsList: false,
        pip: false,
        settingsDialogOpen: false,
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
      window.log.warn('No active call to remove');
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

  if (action.type === DECLINE_CALL) {
    return removeConversationFromState(state, action.payload.conversationId);
  }

  if (action.type === INCOMING_CALL) {
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
        showParticipantsList: false,
        pip: false,
        settingsDialogOpen: false,
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
      window.log.warn('Cannot update state for a non-direct call');
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

  if (action.type === GROUP_CALL_STATE_CHANGE) {
    const {
      connectionState,
      conversationId,
      hasLocalAudio,
      hasLocalVideo,
      joinState,
      ourConversationId,
      peekInfo,
      remoteParticipants,
    } = action.payload;

    let newActiveCallState: ActiveCallStateType | undefined;

    if (connectionState === GroupCallConnectionState.NotConnected) {
      newActiveCallState =
        state.activeCallState?.conversationId === conversationId
          ? undefined
          : state.activeCallState;

      if (!isAnybodyElseInGroupCall(peekInfo, ourConversationId)) {
        return {
          ...state,
          callsByConversation: omit(callsByConversation, conversationId),
          activeCallState: newActiveCallState,
        };
      }
    } else {
      newActiveCallState =
        state.activeCallState?.conversationId === conversationId
          ? {
              ...state.activeCallState,
              hasLocalAudio,
              hasLocalVideo,
            }
          : state.activeCallState;
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
          peekInfo,
          remoteParticipants,
        },
      },
      activeCallState: newActiveCallState,
    };
  }

  if (action.type === PEEK_NOT_CONNECTED_GROUP_CALL_FULFILLED) {
    const { conversationId, peekInfo, ourConversationId } = action.payload;

    const existingCall = getOwn(state.callsByConversation, conversationId) || {
      callMode: CallMode.Group,
      conversationId,
      connectionState: GroupCallConnectionState.NotConnected,
      joinState: GroupCallJoinState.NotJoined,
      peekInfo: {
        conversationIds: [],
        maxDevices: Infinity,
        deviceCount: 0,
      },
      remoteParticipants: [],
    };

    if (existingCall.callMode !== CallMode.Group) {
      window.log.error(
        'Unexpected state: trying to update a non-group call. Doing nothing'
      );
      return state;
    }

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

    if (!isAnybodyElseInGroupCall(peekInfo, ourConversationId)) {
      return removeConversationFromState(state, conversationId);
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

  if (action.type === REMOTE_VIDEO_CHANGE) {
    const { conversationId, hasVideo } = action.payload;
    const call = getOwn(state.callsByConversation, conversationId);
    if (call?.callMode !== CallMode.Direct) {
      window.log.warn('Cannot update remote video for a non-direct call');
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

  if (action.type === SET_LOCAL_AUDIO_FULFILLED) {
    if (!state.activeCallState) {
      window.log.warn('Cannot set local audio with no active call');
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
      window.log.warn('Cannot set local video with no active call');
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
      window.log.warn('Cannot toggle settings when there is no active call');
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
      window.log.warn(
        'Cannot toggle participants list when there is no active call'
      );
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
      window.log.warn('Cannot toggle PiP when there is no active call');
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

  return state;
}
