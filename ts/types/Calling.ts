// Must be kept in sync with RingRTC.AudioDevice
export interface AudioDevice {
  // Name, present on every platform.
  name: string;
  // Index of this device, starting from 0.
  index: number;
  // Index of this device out of all devices sharing the same name.
  same_name_index: number;
  // If present, a unique and stable identifier of this device. Only available on WIndows.
  unique_id?: string;
}

// This must be kept in sync with RingRTC.CallState.
export enum CallState {
  Prering = 'init',
  Ringing = 'ringing',
  Accepted = 'connected',
  Reconnecting = 'connecting',
  Ended = 'ended',
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

export type ChangeIODevicePayloadType =
  | { type: CallingDeviceType.CAMERA; selectedDevice: string }
  | { type: CallingDeviceType.MICROPHONE; selectedDevice: AudioDevice }
  | { type: CallingDeviceType.SPEAKER; selectedDevice: AudioDevice };
