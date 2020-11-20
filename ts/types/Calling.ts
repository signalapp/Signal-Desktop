// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ColorType } from './Colors';

export enum CallMode {
  None = 'None',
  Direct = 'Direct',
  Group = 'Group',
}

// Ideally, we would import many of these directly from RingRTC. But because Storybook
//   cannot import RingRTC (as it runs in the browser), we have these copies. That also
//   means we have to convert the "real" enum to our enum in some cases.

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

// Must be kept in sync with RingRTC's ConnectionState
export enum GroupCallConnectionState {
  NotConnected = 0,
  Connecting = 1,
  Connected = 2,
  Reconnecting = 3,
}

// Must be kept in sync with RingRTC's JoinState
export enum GroupCallJoinState {
  NotJoined = 0,
  Joining = 1,
  Joined = 2,
}

// TODO: The way we deal with remote participants isn't ideal. See DESKTOP-949.
export interface GroupCallPeekedParticipantType {
  avatarPath?: string;
  color?: ColorType;
  firstName?: string;
  isSelf: boolean;
  name?: string;
  profileName?: string;
  title: string;
}
export interface GroupCallRemoteParticipantType {
  avatarPath?: string;
  color?: ColorType;
  demuxId: number;
  firstName?: string;
  hasRemoteAudio: boolean;
  hasRemoteVideo: boolean;
  isSelf: boolean;
  name?: string;
  profileName?: string;
  title: string;
  videoAspectRatio: number;
}

// Should match RingRTC's VideoFrameSource
export interface VideoFrameSource {
  receiveVideoFrame(buffer: ArrayBuffer): [number, number] | undefined;
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
