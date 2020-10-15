import { CallEndedReason } from 'ringrtc';
import { notify } from '../../services/notify';
import { calling } from '../../services/calling';
import {
  CallingDeviceType,
  CallState,
  ChangeIODevicePayloadType,
  MediaDeviceSettings,
} from '../../types/Calling';
import { ColorType } from '../../types/Colors';
import { NoopActionType } from './noop';
import { callingTones } from '../../util/callingTones';
import { requestCameraPermissions } from '../../util/callingPermissions';
import {
  bounceAppIconStart,
  bounceAppIconStop,
} from '../../shims/bounceAppIcon';

// State

export type CallId = unknown;

export type CallDetailsType = {
  acceptedTime?: number;
  callId: CallId;
  isIncoming: boolean;
  isVideoCall: boolean;

  id: string;
  avatarPath?: string;
  color?: ColorType;
  name?: string;
  phoneNumber?: string;
  profileName?: string;
  title: string;
};

export type CallingStateType = MediaDeviceSettings & {
  callDetails?: CallDetailsType;
  callState?: CallState;
  callEndedReason?: CallEndedReason;
  hasLocalAudio: boolean;
  hasLocalVideo: boolean;
  hasRemoteVideo: boolean;
  participantsList: boolean;
  pip: boolean;
  settingsDialogOpen: boolean;
};

export type AcceptCallType = {
  callId: CallId;
  asVideoCall: boolean;
};

export type CallStateChangeType = {
  callState: CallState;
  callDetails: CallDetailsType;
  callEndedReason?: CallEndedReason;
};

export type DeclineCallType = {
  callId: CallId;
};

export type HangUpType = {
  callId: CallId;
};

export type IncomingCallType = {
  callDetails: CallDetailsType;
};

export type OutgoingCallType = {
  callDetails: CallDetailsType;
};

export type RemoteVideoChangeType = {
  remoteVideoEnabled: boolean;
};

export type SetLocalAudioType = {
  callId?: CallId;
  enabled: boolean;
};

export type SetLocalVideoType = {
  callId?: CallId;
  enabled: boolean;
};

export type SetLocalPreviewType = {
  element: React.RefObject<HTMLVideoElement> | undefined;
};

export type SetRendererCanvasType = {
  element: React.RefObject<HTMLCanvasElement> | undefined;
};

// Actions

const ACCEPT_CALL = 'calling/ACCEPT_CALL';
const CANCEL_CALL = 'calling/CANCEL_CALL';
const SHOW_CALL_LOBBY = 'calling/SHOW_CALL_LOBBY';
const CALL_STATE_CHANGE = 'calling/CALL_STATE_CHANGE';
const CALL_STATE_CHANGE_FULFILLED = 'calling/CALL_STATE_CHANGE_FULFILLED';
const CHANGE_IO_DEVICE = 'calling/CHANGE_IO_DEVICE';
const CHANGE_IO_DEVICE_FULFILLED = 'calling/CHANGE_IO_DEVICE_FULFILLED';
const CLOSE_NEED_PERMISSION_SCREEN = 'calling/CLOSE_NEED_PERMISSION_SCREEN';
const DECLINE_CALL = 'calling/DECLINE_CALL';
const HANG_UP = 'calling/HANG_UP';
const INCOMING_CALL = 'calling/INCOMING_CALL';
const OUTGOING_CALL = 'calling/OUTGOING_CALL';
const REFRESH_IO_DEVICES = 'calling/REFRESH_IO_DEVICES';
const REMOTE_VIDEO_CHANGE = 'calling/REMOTE_VIDEO_CHANGE';
const SET_LOCAL_AUDIO = 'calling/SET_LOCAL_AUDIO';
const SET_LOCAL_VIDEO = 'calling/SET_LOCAL_VIDEO';
const SET_LOCAL_VIDEO_FULFILLED = 'calling/SET_LOCAL_VIDEO_FULFILLED';
const START_CALL = 'calling/START_CALL';
const TOGGLE_PARTICIPANTS = 'calling/TOGGLE_PARTICIPANTS';
const TOGGLE_PIP = 'calling/TOGGLE_PIP';
const TOGGLE_SETTINGS = 'calling/TOGGLE_SETTINGS';

type AcceptCallActionType = {
  type: 'calling/ACCEPT_CALL';
  payload: AcceptCallType;
};

type CancelCallActionType = {
  type: 'calling/CANCEL_CALL';
};

type CallLobbyActionType = {
  type: 'calling/SHOW_CALL_LOBBY';
  payload: OutgoingCallType;
};

type CallStateChangeActionType = {
  type: 'calling/CALL_STATE_CHANGE';
  payload: Promise<CallStateChangeType>;
};

type CallStateChangeFulfilledActionType = {
  type: 'calling/CALL_STATE_CHANGE_FULFILLED';
  payload: CallStateChangeType;
};

type ChangeIODeviceActionType = {
  type: 'calling/CHANGE_IO_DEVICE';
  payload: Promise<ChangeIODevicePayloadType>;
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
  payload: OutgoingCallType;
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
  type: 'calling/SET_LOCAL_AUDIO';
  payload: SetLocalAudioType;
};

type SetLocalVideoActionType = {
  type: 'calling/SET_LOCAL_VIDEO';
  payload: Promise<SetLocalVideoType>;
};

type SetLocalVideoFulfilledActionType = {
  type: 'calling/SET_LOCAL_VIDEO_FULFILLED';
  payload: SetLocalVideoType;
};

type StartCallActionType = {
  type: 'calling/START_CALL';
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
  | AcceptCallActionType
  | CancelCallActionType
  | CallLobbyActionType
  | CallStateChangeActionType
  | CallStateChangeFulfilledActionType
  | ChangeIODeviceActionType
  | ChangeIODeviceFulfilledActionType
  | CloseNeedPermissionScreenActionType
  | DeclineCallActionType
  | HangUpActionType
  | IncomingCallActionType
  | OutgoingCallActionType
  | RefreshIODevicesActionType
  | RemoteVideoChangeActionType
  | SetLocalAudioActionType
  | SetLocalVideoActionType
  | SetLocalVideoFulfilledActionType
  | StartCallActionType
  | ToggleParticipantsActionType
  | TogglePipActionType
  | ToggleSettingsActionType;

// Action Creators

function acceptCall(
  payload: AcceptCallType
): AcceptCallActionType | NoopActionType {
  (async () => {
    try {
      await calling.accept(payload.callId, payload.asVideoCall);
    } catch (err) {
      window.log.error(`Failed to acceptCall: ${err.stack}`);
    }
  })();

  return {
    type: ACCEPT_CALL,
    payload,
  };
}

function callStateChange(
  payload: CallStateChangeType
): CallStateChangeActionType {
  return {
    type: CALL_STATE_CHANGE,
    payload: doCallStateChange(payload),
  };
}

function changeIODevice(
  payload: ChangeIODevicePayloadType
): ChangeIODeviceActionType {
  return {
    type: CHANGE_IO_DEVICE,
    payload: doChangeIODevice(payload),
  };
}

async function doChangeIODevice(
  payload: ChangeIODevicePayloadType
): Promise<ChangeIODevicePayloadType> {
  if (payload.type === CallingDeviceType.CAMERA) {
    await calling.setPreferredCamera(payload.selectedDevice);
  } else if (payload.type === CallingDeviceType.MICROPHONE) {
    calling.setPreferredMicrophone(payload.selectedDevice);
  } else if (payload.type === CallingDeviceType.SPEAKER) {
    calling.setPreferredSpeaker(payload.selectedDevice);
  }

  return payload;
}

async function doCallStateChange(
  payload: CallStateChangeType
): Promise<CallStateChangeType> {
  const { callDetails, callState } = payload;
  const { isIncoming } = callDetails;
  if (callState === CallState.Ringing && isIncoming) {
    await callingTones.playRingtone();
    await showCallNotification(callDetails);
    bounceAppIconStart();
  }
  if (callState !== CallState.Ringing) {
    await callingTones.stopRingtone();
    bounceAppIconStop();
  }
  if (callState === CallState.Ended) {
    await callingTones.playEndCall();
  }
  return payload;
}

async function showCallNotification(callDetails: CallDetailsType) {
  const canNotify = await window.getCallSystemNotification();
  if (!canNotify) {
    return;
  }
  const { title, isVideoCall } = callDetails;
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
  calling.decline(payload.callId);

  return {
    type: DECLINE_CALL,
    payload,
  };
}

function hangUp(payload: HangUpType): HangUpActionType {
  calling.hangup(payload.callId);

  return {
    type: HANG_UP,
    payload,
  };
}

function incomingCall(payload: IncomingCallType): IncomingCallActionType {
  return {
    type: INCOMING_CALL,
    payload,
  };
}

function outgoingCall(payload: OutgoingCallType): OutgoingCallActionType {
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

function setLocalPreview(payload: SetLocalPreviewType): NoopActionType {
  calling.videoCapturer.setLocalPreview(payload.element);

  return {
    type: 'NOOP',
    payload: null,
  };
}

function setRendererCanvas(payload: SetRendererCanvasType): NoopActionType {
  calling.videoRenderer.setCanvas(payload.element);

  return {
    type: 'NOOP',
    payload: null,
  };
}

function setLocalAudio(payload: SetLocalAudioType): SetLocalAudioActionType {
  if (payload.callId) {
    calling.setOutgoingAudio(payload.callId, payload.enabled);
  }

  return {
    type: SET_LOCAL_AUDIO,
    payload,
  };
}

function setLocalVideo(payload: SetLocalVideoType): SetLocalVideoActionType {
  return {
    type: SET_LOCAL_VIDEO,
    payload: doSetLocalVideo(payload),
  };
}

function showCallLobby(payload: OutgoingCallType): CallLobbyActionType {
  return {
    type: SHOW_CALL_LOBBY,
    payload,
  };
}

function startCall(payload: OutgoingCallType): StartCallActionType {
  const { callDetails } = payload;
  window.Signal.Services.calling.startOutgoingCall(
    callDetails.id,
    callDetails.isVideoCall
  );

  return {
    type: START_CALL,
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

async function doSetLocalVideo(
  payload: SetLocalVideoType
): Promise<SetLocalVideoType> {
  if (await requestCameraPermissions()) {
    if (payload.callId) {
      calling.setOutgoingVideo(payload.callId, payload.enabled);
    } else if (payload.enabled) {
      calling.enableLocalCamera();
    } else {
      calling.disableLocalCamera();
    }
    return payload;
  }

  return {
    ...payload,
    enabled: false,
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
  incomingCall,
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

function getEmptyState(): CallingStateType {
  return {
    availableCameras: [],
    availableMicrophones: [],
    availableSpeakers: [],
    callDetails: undefined,
    callState: undefined,
    callEndedReason: undefined,
    hasLocalAudio: false,
    hasLocalVideo: false,
    hasRemoteVideo: false,
    participantsList: false,
    pip: false,
    selectedCamera: undefined,
    selectedMicrophone: undefined,
    selectedSpeaker: undefined,
    settingsDialogOpen: false,
  };
}

export function reducer(
  state: CallingStateType = getEmptyState(),
  action: CallingActionType
): CallingStateType {
  if (action.type === SHOW_CALL_LOBBY) {
    return {
      ...state,
      callDetails: action.payload.callDetails,
      callState: undefined,
      hasLocalAudio: true,
      hasLocalVideo: action.payload.callDetails.isVideoCall,
    };
  }

  if (action.type === START_CALL) {
    return {
      ...state,
      callState: CallState.Prering,
    };
  }

  if (action.type === ACCEPT_CALL) {
    return {
      ...state,
      hasLocalAudio: true,
      hasLocalVideo: action.payload.asVideoCall,
    };
  }

  if (
    action.type === CANCEL_CALL ||
    action.type === DECLINE_CALL ||
    action.type === HANG_UP ||
    action.type === CLOSE_NEED_PERMISSION_SCREEN
  ) {
    return getEmptyState();
  }

  if (action.type === INCOMING_CALL) {
    return {
      ...state,
      callDetails: action.payload.callDetails,
      callState: CallState.Prering,
    };
  }

  if (action.type === OUTGOING_CALL) {
    return {
      ...state,
      callDetails: action.payload.callDetails,
      callState: CallState.Prering,
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
      return getEmptyState();
    }
    return {
      ...state,
      callState: action.payload.callState,
      callEndedReason: action.payload.callEndedReason,
    };
  }

  if (action.type === REMOTE_VIDEO_CHANGE) {
    return {
      ...state,
      hasRemoteVideo: action.payload.remoteVideoEnabled,
    };
  }

  if (action.type === SET_LOCAL_AUDIO) {
    return {
      ...state,
      hasLocalAudio: action.payload.enabled,
    };
  }

  if (action.type === SET_LOCAL_VIDEO_FULFILLED) {
    return {
      ...state,
      hasLocalVideo: action.payload.enabled,
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
    return {
      ...state,
      settingsDialogOpen: !state.settingsDialogOpen,
    };
  }

  if (action.type === TOGGLE_PARTICIPANTS) {
    return {
      ...state,
      participantsList: !state.participantsList,
    };
  }

  if (action.type === TOGGLE_PIP) {
    return {
      ...state,
      pip: !state.pip,
    };
  }

  return state;
}
