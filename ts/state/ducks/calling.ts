// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ThunkAction } from 'redux-thunk';
import { CallEndedReason } from 'ringrtc';
import { has, omit } from 'lodash';
import { getOwn } from '../../util/getOwn';
import { notify } from '../../services/notify';
import { calling } from '../../services/calling';
import { StateType as RootStateType } from '../reducer';
import { getActiveCall } from '../selectors/calling';
import {
  CallingDeviceType,
  CallState,
  ChangeIODevicePayloadType,
  MediaDeviceSettings,
} from '../../types/Calling';
import { callingTones } from '../../util/callingTones';
import { requestCameraPermissions } from '../../util/callingPermissions';
import {
  bounceAppIconStart,
  bounceAppIconStop,
} from '../../shims/bounceAppIcon';

// State

export interface DirectCallStateType {
  conversationId: string;
  callState?: CallState;
  callEndedReason?: CallEndedReason;
  isIncoming: boolean;
  isVideoCall: boolean;
  hasRemoteVideo?: boolean;
}

export interface ActiveCallStateType {
  conversationId: string;
  joinedAt?: number;
  hasLocalAudio: boolean;
  hasLocalVideo: boolean;
  participantsList: boolean;
  pip: boolean;
  settingsDialogOpen: boolean;
}

export type CallingStateType = MediaDeviceSettings & {
  callsByConversation: { [conversationId: string]: DirectCallStateType };
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

export type DeclineCallType = {
  conversationId: string;
};

export type HangUpType = {
  conversationId: string;
};

export type IncomingCallType = {
  conversationId: string;
  isVideoCall: boolean;
};

export type StartCallType = {
  conversationId: string;
  hasLocalAudio: boolean;
  hasLocalVideo: boolean;
};

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

export type ShowCallLobbyType = {
  conversationId: string;
  isVideoCall: boolean;
};

export type SetLocalPreviewType = {
  element: React.RefObject<HTMLVideoElement> | undefined;
};

export type SetRendererCanvasType = {
  element: React.RefObject<HTMLCanvasElement> | undefined;
};

// Helpers

// Actions

const ACCEPT_CALL_PENDING = 'calling/ACCEPT_CALL_PENDING';
const CANCEL_CALL = 'calling/CANCEL_CALL';
const SHOW_CALL_LOBBY = 'calling/SHOW_CALL_LOBBY';
const CALL_STATE_CHANGE_FULFILLED = 'calling/CALL_STATE_CHANGE_FULFILLED';
const CHANGE_IO_DEVICE_FULFILLED = 'calling/CHANGE_IO_DEVICE_FULFILLED';
const CLOSE_NEED_PERMISSION_SCREEN = 'calling/CLOSE_NEED_PERMISSION_SCREEN';
const DECLINE_CALL = 'calling/DECLINE_CALL';
const HANG_UP = 'calling/HANG_UP';
const INCOMING_CALL = 'calling/INCOMING_CALL';
const OUTGOING_CALL = 'calling/OUTGOING_CALL';
const REFRESH_IO_DEVICES = 'calling/REFRESH_IO_DEVICES';
const REMOTE_VIDEO_CHANGE = 'calling/REMOTE_VIDEO_CHANGE';
const SET_LOCAL_AUDIO_FULFILLED = 'calling/SET_LOCAL_AUDIO_FULFILLED';
const SET_LOCAL_VIDEO_FULFILLED = 'calling/SET_LOCAL_VIDEO_FULFILLED';
const START_CALL = 'calling/START_CALL';
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
  payload: StartCallType;
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

type StartCallActionType = {
  type: 'calling/START_CALL';
  payload: StartCallType;
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
  | HangUpActionType
  | IncomingCallActionType
  | OutgoingCallActionType
  | RefreshIODevicesActionType
  | RemoteVideoChangeActionType
  | SetLocalAudioActionType
  | SetLocalVideoFulfilledActionType
  | ShowCallLobbyActionType
  | StartCallActionType
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

function cancelCall(): CancelCallActionType {
  window.Signal.Services.calling.stopCallingLobby();

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

function outgoingCall(payload: StartCallType): OutgoingCallActionType {
  callingTones.playRingtone();

  return {
    type: OUTGOING_CALL,
    payload,
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
    const { conversationId } = getActiveCall(getState().calling) || {};
    if (conversationId) {
      calling.setOutgoingAudio(conversationId, payload.enabled);
    }

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
    let enabled: boolean;
    if (await requestCameraPermissions()) {
      const { conversationId, callState } =
        getActiveCall(getState().calling) || {};
      if (conversationId && callState) {
        calling.setOutgoingVideo(conversationId, payload.enabled);
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

function startCall(payload: StartCallType): StartCallActionType {
  calling.startOutgoingCall(
    payload.conversationId,
    payload.hasLocalAudio,
    payload.hasLocalVideo
  );

  return {
    type: START_CALL,
    payload,
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
  hangUp,
  receiveIncomingCall,
  outgoingCall,
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
    return {
      ...state,
      callsByConversation: {
        ...callsByConversation,
        [action.payload.conversationId]: {
          conversationId: action.payload.conversationId,
          isIncoming: false,
          isVideoCall: action.payload.isVideoCall,
        },
      },
      activeCallState: {
        conversationId: action.payload.conversationId,
        hasLocalAudio: true,
        hasLocalVideo: action.payload.isVideoCall,
        participantsList: false,
        pip: false,
        settingsDialogOpen: false,
      },
    };
  }

  if (action.type === START_CALL) {
    return {
      ...state,
      callsByConversation: {
        ...callsByConversation,
        [action.payload.conversationId]: {
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
        participantsList: false,
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
        participantsList: false,
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
    if (!state.activeCallState) {
      window.log.warn('No active call to remove');
      return state;
    }
    return removeConversationFromState(
      state,
      state.activeCallState.conversationId
    );
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
        participantsList: false,
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
    if (!call) {
      window.log.warn('Cannot update state for non-existent call');
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

  if (action.type === REMOTE_VIDEO_CHANGE) {
    const { conversationId, hasVideo } = action.payload;
    const call = getOwn(state.callsByConversation, conversationId);
    if (!call) {
      window.log.warn('Cannot update remote video for a non-existent call');
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
        participantsList: !activeCallState.participantsList,
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
