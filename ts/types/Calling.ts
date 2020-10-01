// Must be kept in sync with RingRTC.CallState
export enum CallState {
  Prering = 'init',
  Ringing = 'ringing',
  Accepted = 'connected',
  Reconnecting = 'connecting',
  Ended = 'ended',
}

// Must be kept in sync with RingRTC.CallEndedReason
export enum CallEndedReason {
  LocalHangup = 'LocalHangup',
  RemoteHangup = 'RemoteHangup',
  RemoteHangupNeedPermission = 'RemoteHangupNeedPermission',
  Declined = 'Declined',
  Busy = 'Busy',
  Glare = 'Glare',
  ReceivedOfferExpired = 'ReceivedOfferExpired',
  ReceivedOfferWhileActive = 'ReceivedOfferWhileActive',
  ReceivedOfferWithGlare = 'ReceivedOfferWithGlare',
  SignalingFailure = 'SignalingFailure',
  ConnectionFailure = 'ConnectionFailure',
  InternalFailure = 'InternalFailure',
  Timeout = 'Timeout',
  AcceptedOnAnotherDevice = 'AcceptedOnAnotherDevice',
  DeclinedOnAnotherDevice = 'DeclinedOnAnotherDevice',
  BusyOnAnotherDevice = 'BusyOnAnotherDevice',
  CallerIsNotMultiring = 'CallerIsNotMultiring',
}

// Must be kept in sync with RingRTC.AudioDevice
export interface AudioDevice {
  // Device name.
  name: string;
  // Index of this device, starting from 0.
  index: number;
  // A unique and somewhat stable identifier of this device.
  uniqueId: string;
  // If present, the identifier of a localized string to substitute for the device name.
  i18nKey?: string;
}

export enum CallingDeviceType {
  CAMERA,
  MICROPHONE,
  SPEAKER,
}

export type MediaDeviceSettings = {
  availableMicrophones: Array<AudioDevice>;
  selectedMicrophone: AudioDevice | undefined;
  availableSpeakers: Array<AudioDevice>;
  selectedSpeaker: AudioDevice | undefined;
  availableCameras: Array<MediaDeviceInfo>;
  selectedCamera: string | undefined;
};

export type CallHistoryDetailsType = {
  wasIncoming: boolean;
  wasVideoCall: boolean;
  wasDeclined: boolean;
  acceptedTime?: number;
  endedTime: number;
};

export type ChangeIODevicePayloadType =
  | { type: CallingDeviceType.CAMERA; selectedDevice: string }
  | { type: CallingDeviceType.MICROPHONE; selectedDevice: AudioDevice }
  | { type: CallingDeviceType.SPEAKER; selectedDevice: AudioDevice };
