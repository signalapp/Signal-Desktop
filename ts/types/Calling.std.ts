// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// ORBITAL: Calling feature removed - stub only

export type CallingConversationType = never;
export type CallState = never;
export type GroupCallConnectionState = never;
export type GroupCallJoinState = never;

export const CallState = {} as const;
export const GroupCallConnectionState = {} as const;
export const GroupCallJoinState = {} as const;

export enum ScreenShareStatus {
  Disconnected = 'Disconnected',
  Connected = 'Connected',
}

export type MediaDeviceSettings = {
  availableCameras: ReadonlyArray<MediaDeviceInfo>;
  availableMicrophones: ReadonlyArray<MediaDeviceInfo>;
  availableSpeakers: ReadonlyArray<MediaDeviceInfo>;
  selectedCamera: MediaDeviceInfo | undefined;
  selectedMicrophone: MediaDeviceInfo | undefined;
  selectedSpeaker: MediaDeviceInfo | undefined;
};

export type PresentableSource = {
  id: string;
  name: string;
  thumbnail: string;
  appIcon?: string;
};
